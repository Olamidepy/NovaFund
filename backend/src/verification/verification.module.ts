import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KycAuditEntity } from './entities/kyc-audit.entity';
import { KycAdminService } from './services/kyc-admin.service';
import { ZkKycService } from './services/zk-kyc.service';
import { VioletProvider } from './services/providers/violet.provider';
import { GalxeProvider } from './services/providers/galxe.provider';
import { KycAdminController } from './controllers/kyc-admin.controller';
import { ZkKycController } from './controllers/zk-kyc.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycAuditEntity]),
  ],
  controllers: [KycAdminController, ZkKycController],
  providers: [
    KycAdminService,
    ZkKycService,
    VioletProvider,
    GalxeProvider,
  ],
  exports: [ZkKycService],
})
export class VerificationModule {}