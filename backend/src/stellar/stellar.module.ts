import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RpcFallbackService } from './rpc-fallback.service';
import { RpcFallbackController } from './rpc-fallback.controller';
import { PathfinderService } from './pathfinder.service';
import { FederationService } from './federation.service';
import { FederationController } from './federation.controller';
import { AssetDiscoveryService } from './asset-discovery.service';
import { AssetDiscoveryController } from './asset-discovery.controller';
import { PrismaService } from '../prisma.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountingService } from './accounting.service';
import { EcosystemSyncService } from './ecosystem-sync.service';
import { StellarInsightsResolver } from './stellar-insights.resolver';
import { StellarService } from './stellar.service';
import { ReservesService } from './reserves.service';
import { OracleModule } from '../oracle/oracle.module';

@Module({
  imports: [
    HttpModule,
    ScheduleModule.forRoot(),
    OracleModule,
  ],
  providers: [
    RpcFallbackService,
    PathfinderService,
    FederationService,
    AssetDiscoveryService,
    AccountingService,
    EcosystemSyncService,
    StellarInsightsResolver,
    PrismaService,
    StellarService,
    ReservesService,
  ],
  controllers: [
    RpcFallbackController,
    FederationController,
    AssetDiscoveryController
  ],
  exports: [
    RpcFallbackService,
    PathfinderService,
    FederationService,
    AssetDiscoveryService,
    AccountingService,
    EcosystemSyncService,
    StellarService,
    ReservesService,
  ],
})
export class StellarModule {}
