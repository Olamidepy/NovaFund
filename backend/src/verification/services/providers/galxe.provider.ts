import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZkKycProvider } from './zk-kyc-provider.interface';

@Injectable()
export class GalxeProvider implements ZkKycProvider {
  private readonly logger = new Logger(GalxeProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GALXE_API_KEY', '');
    this.apiUrl = this.configService.get<string>('GALXE_API_URL', 'https://api.galxe.com');
  }

  async createVerificationSession(userId: string): Promise<{
    sessionId: string;
    verificationUrl: string;
  }> {
    try {
      // Galxe API integration
      const response = await fetch(`${this.apiUrl}/v1/kyc/verification/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          redirectUrl: `${this.configService.get<string>('APP_URL')}/api/verification/zk-kyc/callback`,
          verificationTypes: ['identity', 'age_verification'],
          privacyMode: true, // Enable ZK mode
        }),
      });

      if (!response.ok) {
        throw new Error(`Galxe API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        sessionId: data.sessionId,
        verificationUrl: data.verificationUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to create Galxe verification session: ${error.message}`);
      throw error;
    }
  }

  async verifyProof(proofData: string, publicInputs?: string): Promise<{
    isValid: boolean;
    userId?: string;
    attributes?: Record<string, any>;
  }> {
    try {
      // Verify the ZK proof with Galxe
      const response = await fetch(`${this.apiUrl}/v1/kyc/verification/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proof: proofData,
          publicInputs,
          verifyAttributes: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Galxe verification error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        isValid: result.verified,
        userId: result.userId,
        attributes: result.verifiedAttributes, // ZK-verified attributes
      };
    } catch (error) {
      this.logger.error(`Failed to verify Galxe proof: ${error.message}`);
      return { isValid: false };
    }
  }

  getProviderName(): string {
    return 'galxe';
  }
}