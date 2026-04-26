// public.controller.ts

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectDto } from './dto/project.dto';
import { StatsDto } from './dto/stats.dto';

@ApiTags('Public API')
@Controller('v1')
export class PublicController {
  /**
   * GET /v1/projects
   */
  @Get('projects')
  @ApiOperation({ summary: 'Get all public projects' })
  @ApiResponse({ status: 200, type: [ProjectDto] })
  async getProjects(): Promise<ProjectDto[]> {
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
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({ status: 200, type: StatsDto })
  async getStats(): Promise<StatsDto> {
    return {
      totalProjects: 120,
      totalFunding: 500000,
      activeUsers: 3200,
    };
  }
}