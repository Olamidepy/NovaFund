// src/modules/billing/billing.module.ts

import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [ReputationModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}