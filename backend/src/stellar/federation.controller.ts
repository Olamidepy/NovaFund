import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FederationService, EmailToWalletResult } from './federation.service';

class RegisterWalletDto {
  email: string;
  stellarPublicKey: string;
}

class ResolveRecipientDto {
  recipient: string;
}

@ApiTags('Federation')
@Controller()
export class FederationController {
  constructor(private readonly federation: FederationService) {}

  @Get('federation')
  @ApiOperation({ summary: 'Stellar SEP-0002 federation server endpoint' })
  @ApiQuery({ name: 'q', description: 'Federation address or account ID' })
  @ApiQuery({ name: 'type', enum: ['name', 'id', 'txid'] })
  async federationQuery(
    @Query('q') q: string,
    @Query('type') type: 'name' | 'id' | 'txid' = 'name',
  ) {
    return this.federation.handleFederationQuery(q, type);
  }

  @Post('api/v1/federation/wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register email → wallet mapping for current user' })
  async registerWallet(@Body() dto: RegisterWalletDto) {
    return this.federation.registerEmailMapping(
      dto.email,
      dto.email,
      dto.stellarPublicKey,
    );
  }

  @Post('api/v1/federation/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a recipient to a Stellar account' })
  async resolveRecipient(
    @Body() dto: ResolveRecipientDto,
  ): Promise<EmailToWalletResult> {
    return this.federation.resolveRecipient(dto.recipient);
  }

  @Get('api/v1/federation/lookup/:email')
  @ApiOperation({ summary: 'Look up a wallet by verified email address' })
  async lookupByEmail(
    @Param('email') email: string,
  ): Promise<EmailToWalletResult> {
    return this.federation.resolveEmail(decodeURIComponent(email));
  }
}