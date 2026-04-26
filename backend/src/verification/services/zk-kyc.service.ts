import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { KycStatus } from '../entities/kyc-status.enum';
import { ZkKycProvider } from './providers/zk-kyc-provider.interface';
import { VioletProvider } from './providers/violet.provider';
import { GalxeProvider } from './providers/galxe.provider';

export interface ZkKycVerificationRequest {
  userId: string;
  provider: 'violet' | 'galxe';
  proofData: string; // Base64 encoded proof
  publicInputs?: string; // Additional public inputs for verification
}

export interface ZkKycVerificationResponse {
  success: boolean;
  proofHash: string;
  verifiedAt: Date;
  provider: string;
  userId: string;
}

@Injectable()
export class ZkKycService {
  private readonly logger = new Logger(ZkKycService.name);
  private readonly providers: Map<string, ZkKycProvider> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Initialize ZK-KYC providers
    this.providers.set('violet', new VioletProvider(configService));
    this.providers.set('galxe', new GalxeProvider(configService));
  }

  /**
   * Initiate ZK-KYC verification process
   * This creates a verification session with the provider
   */
  async initiateVerification(
    userId: string,
    provider: 'violet' | 'galxe',
  ): Promise<{ sessionId: string; verificationUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('User is already KYC verified');
    }

    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new BadRequestException(`Unsupported ZK-KYC provider: ${provider}`);
    }

    try {
      const session = await providerInstance.createVerificationSession(userId);
      this.logger.log(`Created ZK-KYC session for user ${userId} with provider ${provider}`);

      return session;
    } catch (error) {
      this.logger.error(`Failed to create ZK-KYC session: ${error.message}`);
      throw new BadRequestException('Failed to initiate KYC verification');
    }
  }

  /**
   * Complete ZK-KYC verification with proof submission
   * This verifies the ZK proof and updates user status
   */
  async completeVerification(
    request: ZkKycVerificationRequest,
  ): Promise<ZkKycVerificationResponse> {
    const { userId, provider, proofData } = request;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        zkKycProof: true,
        zkKycProvider: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new BadRequestException(`Unsupported ZK-KYC provider: ${provider}`);
    }

    try {
      // Verify the ZK proof with the provider
      const verificationResult = await providerInstance.verifyProof(proofData, request.publicInputs);

      if (!verificationResult.isValid) {
        throw new BadRequestException('Invalid ZK proof provided');
      }

      // Generate proof hash for on-chain storage (only the hash, not the raw proof)
      const proofHash = await this.generateProofHash(proofData);
      const verifiedAt = new Date();

      // Update user with ZK-KYC verification
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          kycStatus: KycStatus.VERIFIED,
          zkKycProof: proofHash,
          zkKycProvider: provider,
          zkKycVerifiedAt: verifiedAt,
        },
      });

      // Log the verification in audit trail
      await this.prisma.kycAuditEntity.save({
        userId,
        previousStatus: user.kycStatus,
        newStatus: KycStatus.VERIFIED,
        action: 'ZK_VERIFY',
        adminId: 'system', // Automated verification
        reason: `ZK-KYC verification via ${provider}`,
      });

      this.logger.log(`Successfully verified ZK-KYC for user ${userId} with provider ${provider}`);

      return {
        success: true,
        proofHash,
        verifiedAt,
        provider,
        userId,
      };
    } catch (error) {
      this.logger.error(`ZK-KYC verification failed for user ${userId}: ${error.message}`);

      // Update status to rejected on verification failure
      await this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.REJECTED },
      });

      throw new BadRequestException('ZK-KYC verification failed');
    }
  }

  /**
   * Check ZK-KYC verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<{
    status: KycStatus;
    provider?: string;
    verifiedAt?: Date;
    proofHash?: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        zkKycProvider: true,
        zkKycVerifiedAt: true,
        zkKycProof: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return {
      status: user.kycStatus,
      provider: user.zkKycProvider || undefined,
      verifiedAt: user.zkKycVerifiedAt || undefined,
      proofHash: user.zkKycProof || undefined,
    };
  }

  /**
   * Revoke ZK-KYC verification (admin function)
   */
  async revokeVerification(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        zkKycProof: true,
        zkKycProvider: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException('User is not currently KYC verified');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.REJECTED,
        zkKycProof: null,
        zkKycProvider: null,
        zkKycVerifiedAt: null,
      },
    });

    // Log the revocation
    await this.prisma.kycAuditEntity.save({
      userId,
      previousStatus: user.kycStatus,
      newStatus: KycStatus.REJECTED,
      action: 'ZK_REVOKE',
      adminId,
      reason,
    });

    this.logger.log(`Revoked ZK-KYC verification for user ${userId} by admin ${adminId}`);
  }

  /**
   * Generate a hash of the ZK proof for on-chain storage
   * This ensures we never store raw PII on-chain
   */
  private async generateProofHash(proofData: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto
      .createHash('sha256')
      .update(proofData)
      .digest('hex');
  }

  /**
   * Get supported ZK-KYC providers
   */
  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}