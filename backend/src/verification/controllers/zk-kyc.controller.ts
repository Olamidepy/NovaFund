import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZkKycService, ZkKycVerificationRequest } from '../services/zk-kyc.service';
import { InitiateZkKycDto, CompleteZkKycDto, ZkKycStatusDto } from '../dto/zk-kyc.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { WebhookHandler } from '../webhook-handler';

@Controller('verification/zk-kyc')
@UseGuards(JwtAuthGuard)
export class ZkKycController {
  constructor(
    private readonly zkKycService: ZkKycService,
    private readonly webhookHandler: WebhookHandler,
  ) {}

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
   * Webhook callback for ZK-KYC providers.
   * Verifies the provider's asymmetric signature and timestamp before processing.
   * Requires raw body parsing to be enabled for this route.
   */
  @Post('callback/:provider')
  async handleCallback(
    @Param('provider') provider: string,
    @Headers('x-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = (req as any).rawBody as Buffer;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available');
    }

    const payload = this.webhookHandler.verifyAndParse(rawBody, signature, provider);
    return { success: true, userId: payload.userId, status: payload.status };
  }
}