import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZkKycProvider } from './zk-kyc-provider.interface';

@Injectable()
export class VioletProvider implements ZkKycProvider {
  private readonly logger = new Logger(VioletProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VIOLET_API_KEY', '');
    this.apiUrl = this.configService.get<string>('VIOLET_API_URL', 'https://api.violet.co');
  }

  async createVerificationSession(userId: string): Promise<{
    sessionId: string;
    verificationUrl: string;
  }> {
    try {
      // Violet API integration
      const response = await fetch(`${this.apiUrl}/v1/verification/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          callbackUrl: `${this.configService.get<string>('APP_URL')}/api/verification/zk-kyc/callback`,
          requirements: {
            identity: true,
            age: true,
            nationality: false, // Not required for basic KYC
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Violet API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        sessionId: data.sessionId,
        verificationUrl: data.verificationUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to create Violet verification session: ${error.message}`);
      throw error;
    }
  }

  async verifyProof(proofData: string, publicInputs?: string): Promise<{
    isValid: boolean;
    userId?: string;
    attributes?: Record<string, any>;
  }> {
    try {
      // Decode and verify the ZK proof
      const response = await fetch(`${this.apiUrl}/v1/verification/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proof: proofData,
          publicInputs,
        }),
      });

      if (!response.ok) {
        throw new Error(`Violet verification error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        isValid: result.isValid,
        userId: result.userId,
        attributes: result.attributes, // Contains verified attributes like age verification
      };
    } catch (error) {
      this.logger.error(`Failed to verify Violet proof: ${error.message}`);
      return { isValid: false };
    }
  }

  getProviderName(): string {
    return 'violet';
  }
}