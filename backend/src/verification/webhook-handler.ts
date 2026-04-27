import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface KycWebhookPayload {
  userId: string;
  status: 'VERIFIED' | 'REJECTED' | 'PENDING';
  provider: string;
  timestamp: number; // Unix epoch seconds
  [key: string]: unknown;
}

/**
 * Secure KYC webhook handler.
 *
 * Security measures:
 *  1. Asymmetric signature verification (Ed25519 or RSA-SHA256) – impossible to forge
 *     without the provider's private key.
 *  2. Timestamp validation – rejects requests older than WEBHOOK_TOLERANCE_SECONDS
 *     to prevent replay attacks.
 */
@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  /** Maximum age of a webhook request in seconds before it is rejected. */
  private readonly toleranceSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.toleranceSeconds = this.config.get<number>('WEBHOOK_TOLERANCE_SECONDS', 300);
  }

  /**
   * Verify and parse an incoming KYC webhook.
   *
   * @param rawBody   The raw (unparsed) request body as a Buffer.
   * @param signature The value of the `X-Signature` header (Base64 for Ed25519,
   *                  hex for HMAC/RSA).
   * @param provider  The KYC provider name ('sumsub' | 'violet' | 'galxe').
   * @returns         The parsed and validated payload.
   */
  verifyAndParse(
    rawBody: Buffer,
    signature: string,
    provider: string,
  ): KycWebhookPayload {
    if (!signature) {
      throw new UnauthorizedException('Missing X-Signature header');
    }

    // 1. Verify asymmetric signature
    this.verifySignature(rawBody, signature, provider);

    // 2. Parse payload
    let payload: KycWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    // 3. Validate timestamp to prevent replay attacks
    this.validateTimestamp(payload.timestamp);

    this.logger.log(
      `KYC webhook verified: provider=${provider} userId=${payload.userId} status=${payload.status}`,
    );

    return payload;
  }

  // ── private ────────────────────────────────────────────────────────────────

  private verifySignature(rawBody: Buffer, signature: string, provider: string): void {
    const algo = this.config.get<string>(`KYC_${provider.toUpperCase()}_SIG_ALGO`, 'ed25519');
    const publicKeyPem = this.config.get<string>(`KYC_${provider.toUpperCase()}_PUBLIC_KEY`);

    if (!publicKeyPem) {
      throw new UnauthorizedException(
        `No public key configured for provider: ${provider}`,
      );
    }

    const isValid = algo === 'ed25519'
      ? this.verifyEd25519(rawBody, signature, publicKeyPem)
      : this.verifyRsaSha256(rawBody, signature, publicKeyPem);

    if (!isValid) {
      this.logger.warn(`Invalid webhook signature from provider: ${provider}`);
      throw new UnauthorizedException('Webhook signature verification failed');
    }
  }

  private verifyEd25519(data: Buffer, signatureBase64: string, publicKeyPem: string): boolean {
    try {
      return crypto.verify(
        null, // Ed25519 does not use a hash algorithm parameter
        data,
        { key: publicKeyPem, format: 'pem', type: 'spki' },
        Buffer.from(signatureBase64, 'base64'),
      );
    } catch {
      return false;
    }
  }

  private verifyRsaSha256(data: Buffer, signatureHex: string, publicKeyPem: string): boolean {
    try {
      return crypto.verify(
        'sha256',
        data,
        { key: publicKeyPem, format: 'pem', type: 'spki' },
        Buffer.from(signatureHex, 'hex'),
      );
    } catch {
      return false;
    }
  }

  private validateTimestamp(timestamp: number): void {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      throw new BadRequestException('Missing or invalid timestamp in webhook payload');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = nowSeconds - timestamp;

    if (ageSeconds < 0) {
      throw new BadRequestException('Webhook timestamp is in the future');
    }

    if (ageSeconds > this.toleranceSeconds) {
      throw new UnauthorizedException(
        `Webhook timestamp too old (${ageSeconds}s > ${this.toleranceSeconds}s tolerance)`,
      );
    }
  }
}
