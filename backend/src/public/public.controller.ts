// public.controller.ts

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheManagerService } from '../redis/cache-manager.service';

@ApiTags('Public API')
@Controller('v1')
export class PublicController {
  constructor(private readonly cacheManager: CacheManagerService) {}

  /**
   * GET /v1/projects
   */
  @Get('projects')
  @ApiOperation({ summary: 'Get all public projects' })
  @ApiResponse({ status: 200 })
  async getProjects() {
    // TODO: Replace with real service
    return [
      {
        id: '1',
        name: 'NovaFund Alpha',
        description: 'Decentralized funding platform',
        fundingGoal: 10000,
        fundsRaised: 7500,
      },
    ];
  }

  /**
   * GET /v1/stats
   * Returns always-accurate global metrics with sub-10ms response time
   * via event-driven cache invalidation.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({ status: 200 })
  async getStats() {
    return this.cacheManager.getGlobalStats();
  }
}
