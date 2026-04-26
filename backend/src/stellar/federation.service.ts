import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

export interface EmailToWalletResult {
  email: string;
  accountId: string;
  stellarAddress: string;
  displayName: string;
  verified: boolean;
}

@Injectable()
export class FederationService {
  private readonly FEDERATION_DOMAIN = 'novafund.io';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  async registerEmailMapping(userId: string, email: string, stellarPublicKey: string) {
    this.assertValidStellarAddress(stellarPublicKey);
    this.assertValidEmail(email);
    const existing = await this.prisma.federationRecord.findUnique({ where: { email } });
    if (existing && existing.userId !== userId) {
      throw new BadRequestException('This email is already mapped to a different account.');
    }
    return this.prisma.federationRecord.upsert({
      where: { email },
      update: { stellarPublicKey, stellarAddress: this.buildStellarAddress(email), verifiedAt: new Date() },
      create: { userId, email, stellarPublicKey, stellarAddress: this.buildStellarAddress(email), verifiedAt: new Date() },
    });
  }

  async resolveEmail(email: string): Promise<EmailToWalletResult> {
    this.assertValidEmail(email);
    const record = await this.prisma.federationRecord.findUnique({
      where: { email },
      include: { user: true },
    });
    if (!record) {
      throw new NotFoundException(
        `No verified wallet found for ${email}. The recipient may need to connect their Stellar wallet on NovaFund.`,
      );
    }
    return {
      email: record.email,
      accountId: record.stellarPublicKey,
      stellarAddress: record.stellarAddress,
      displayName: record.user?.profileData?.['displayName'] ?? email,
      verified: !!record.verifiedAt,
    };
  }

  async resolveRecipient(input: string): Promise<EmailToWalletResult> {
    const trimmed = input.trim();
    if (this.isStellarPublicKey(trimmed)) return this.wrapRawKey(trimmed);
    if (this.isFederationAddress(trimmed)) return this.resolveFederationAddress(trimmed);
    if (this.isEmail(trimmed)) return this.resolveEmail(trimmed);
    throw new BadRequestException('Input must be an email, Stellar address (alice*domain.com), or G... public key.');
  }

  async resolveFederationAddress(address: string): Promise<EmailToWalletResult> {
    const [name, domain] = address.split('*');
    if (domain === this.FEDERATION_DOMAIN) {
      return this.resolveEmail(this.federationNameToEmail(name));
    }
    const federationServerUrl = await this.discoverFederationServer(domain);
    const params = new URLSearchParams({ q: address, type: 'name' });
    const { data } = await firstValueFrom(
      this.http.get(`${federationServerUrl}?${params}`, { timeout: 5000 }),
    );
    return { email: address, accountId: data.accountId, stellarAddress: address, displayName: address, verified: true };
  }

  async handleFederationQuery(q: string, type: 'name' | 'id' | 'txid') {
    if (type === 'name') {
      const result = await this.resolveFederationAddress(q);
      return { stellarAddress: result.stellarAddress, accountId: result.accountId };
    }
    if (type === 'id') {
      const record = await this.prisma.federationRecord.findUnique({ where: { stellarPublicKey: q } });
      if (!record) throw new NotFoundException(`No federation record for account ${q}`);
      return { stellarAddress: record.stellarAddress, accountId: record.stellarPublicKey };
    }
    throw new BadRequestException(`Unsupported federation query type: ${type}`);
  }

  private async discoverFederationServer(domain: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.get(`https://${domain}/.well-known/stellar.toml`, { responseType: 'text', timeout: 5000 }),
    );
    const match = data.match(/FEDERATION_SERVER\s*=\s*"([^"]+)"/);
    if (!match) throw new NotFoundException(`No FEDERATION_SERVER found for domain "${domain}".`);
    return match[1];
  }

  private async wrapRawKey(publicKey: string): Promise<EmailToWalletResult> {
    const record = await this.prisma.federationRecord.findUnique({
      where: { stellarPublicKey: publicKey },
      include: { user: true },
    });
    return {
      email: record?.email ?? '',
      accountId: publicKey,
      stellarAddress: record?.stellarAddress ?? publicKey,
      displayName: record?.user?.profileData?.['displayName'] ?? this.shortenKey(publicKey),
      verified: !!record,
    };
  }

  private buildStellarAddress(email: string): string {
    return `${email.replace('@', '_').replace(/\./g, '-')}*${this.FEDERATION_DOMAIN}`;
  }

  private federationNameToEmail(name: string): string {
    const atIdx = name.indexOf('_');
    if (atIdx === -1) throw new BadRequestException(`Invalid federation name: ${name}`);
    return `${name.slice(0, atIdx)}@${name.slice(atIdx + 1).replace(/-/g, '.')}`;
  }

  private shortenKey(key: string): string { return `${key.slice(0, 6)}…${key.slice(-4)}`; }
  private isStellarPublicKey(s: string): boolean { return /^G[A-Z2-7]{55}$/.test(s); }
  private isFederationAddress(s: string): boolean { return s.includes('*') && !s.includes('@'); }
  private isEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  private assertValidStellarAddress(key: string): void {
    if (!this.isStellarPublicKey(key)) throw new BadRequestException('Invalid Stellar public key.');
  }
  private assertValidEmail(email: string): void {
    if (!this.isEmail(email)) throw new BadRequestException(`Invalid email address: ${email}`);
  }
}