import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RpcFallbackService } from './rpc-fallback.service';
import { RpcFallbackController } from './rpc-fallback.controller';
import { PathfinderService } from './pathfinder.service';
import { FederationService } from './federation.service';
import { FederationController } from './federation.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [HttpModule],
  providers: [RpcFallbackService, PathfinderService, FederationService, PrismaService],
  controllers: [RpcFallbackController, FederationController],
  exports: [RpcFallbackService, PathfinderService, FederationService],
})
export class StellarModule {}
