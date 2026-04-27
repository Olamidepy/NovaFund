import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma.service';

export const GLOBAL_STATS_CACHE_KEY = 'global:stats';
const GLOBAL_STATS_TTL = 300; // 5 minutes fallback TTL

export interface GlobalStats {
  totalProjects: number;
  totalFunding: number;
  activeUsers: number;
}

/**
 * Event-driven cache manager for global platform statistics.
 *
 * Stats are computed once and cached. The cache is invalidated only when
 * a relevant domain event occurs (new Investment or Payout finalized),
 * ensuring sub-10ms reads while keeping metrics always accurate.
 */
@Injectable()
export class CacheManagerService {
  private readonly logger = new Logger(CacheManagerService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Return cached global stats, computing them on a cache miss.
   */
  async getGlobalStats(): Promise<GlobalStats> {
    const cached = await this.redis.get<GlobalStats>(GLOBAL_STATS_CACHE_KEY);
    if (cached) {
      this.logger.debug('Cache hit: global stats');
      return cached;
    }

    return this.recomputeAndCache();
  }

  /**
   * Call this whenever an Investment or Payout is finalized.
   * Invalidates the stale entry so the next read triggers a fresh computation.
   */
  async invalidateGlobalStats(): Promise<void> {
    await this.redis.del(GLOBAL_STATS_CACHE_KEY);
    this.logger.log('Global stats cache invalidated');
  }

  // ── private ────────────────────────────────────────────────────────────────

  private async recomputeAndCache(): Promise<GlobalStats> {
    this.logger.log('Recomputing global stats');

    const [totalProjects, fundingAgg, activeUsers] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.project.aggregate({ _sum: { currentFunds: true } }),
      this.prisma.user.count(),
    ]);

    const stats: GlobalStats = {
      totalProjects,
      totalFunding: Number(fundingAgg._sum.currentFunds ?? 0),
      activeUsers,
    };

    await this.redis.set(GLOBAL_STATS_CACHE_KEY, stats, GLOBAL_STATS_TTL);
    this.logger.debug('Global stats cached');
    return stats;
  }
}
