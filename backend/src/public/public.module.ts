// public.module.ts

import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { RedisModule } from '../redis/redis.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [RedisModule],
  controllers: [PublicController],
  providers: [PrismaService],
})
export class PublicModule {}
