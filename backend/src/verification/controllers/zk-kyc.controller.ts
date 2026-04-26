import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZkKycService, ZkKycVerificationRequest } from '../services/zk-kyc.service';
import { InitiateZkKycDto, CompleteZkKycDto, ZkKycStatusDto } from '../dto/zk-kyc.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('verification/zk-kyc')
@UseGuards(JwtAuthGuard)
export class ZkKycController {
  constructor(private readonly zkKycService: ZkKycService) {}

  /**
   * Initiate ZK-KYC verification process
   */
  @Post('initiate')
  @Throttle({ default: { ttl: 60_000, limit: 3 } }) // 3 requests per minute
  async initiateVerification(
    @Body() dto: InitiateZkKycDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    try {
      const result = await this.zkKycService.initiateVerification(userId, dto.provider);
      return {
        success: true,
        sessionId: result.sessionId,
        verificationUrl: result.verificationUrl,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Complete ZK-KYC verification with proof
   */
  @Post('complete')
  async completeVerification(
    @Body() dto: CompleteZkKycDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    const request: ZkKycVerificationRequest = {
      userId,
      provider: dto.sessionId.startsWith('violet_') ? 'violet' : 'galxe', // Determine provider from session ID
      proofData: dto.proofData,
      publicInputs: dto.publicInputs,
    };

    try {
      const result = await this.zkKycService.completeVerification(request);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get ZK-KYC verification status
   */
  @Get('status')
  async getVerificationStatus(@Request() req: any) {
    const userId = req.user.id;

    try {
      const status = await this.zkKycService.getVerificationStatus(userId);
      return {
        success: true,
        ...status,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get supported ZK-KYC providers
   */
  @Get('providers')
  getSupportedProviders() {
    return {
      success: true,
      providers: this.zkKycService.getSupportedProviders(),
    };
  }

  /**
   * Webhook callback for ZK-KYC providers
   * This endpoint is called by the ZK-KYC providers when verification is complete
   */
  @Post('callback/:provider')
  async handleCallback(
    @Param('provider') provider: string,
    @Body() callbackData: any,
  ) {
    // This would be called by Violet/Galxe when verification is complete
    // Implementation depends on the specific provider's webhook format

    // For now, just log the callback
    console.log(`ZK-KYC callback from ${provider}:`, callbackData);

    return { success: true };
  }
}