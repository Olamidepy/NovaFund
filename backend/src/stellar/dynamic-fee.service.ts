import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanRpc, Horizon } from '@stellar/stellar-sdk';

export interface FeeStats {
  min: number;
  max: number;
  mode: number;
  p10: number;
  p20: number;
  p30: number;
  p40: number;
  p50: number;
  p60: number;
  p70: number;
  p80: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface DynamicFeeConfig {
  baseFee: number;
  priorityFee: number;
  totalFee: number;
  feeLevel: 'low' | 'medium' | 'high' | 'urgent';
}

@Injectable()
export class DynamicFeeService {
  private readonly logger = new Logger(DynamicFeeService.name);
  private horizonServer: Horizon.Server | null = null;
  private sorobanServer: SorobanRpc.Server | null = null;
  private cachedFeeStats: FeeStats | null = null;
  private lastFeeUpdate: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(private readonly configService: ConfigService) {
    const horizonUrl = this.configService.get<string>(
      'stellar.horizonUrl',
      'https://horizon-testnet.stellar.org',
    );
    
    this.horizonServer = new Horizon.Server(horizonUrl);
    
    // Initialize Soroban RPC if available
    const sorobanUrl = this.configService.get<string>('stellar.sorobanRpcUrl');
    if (sorobanUrl) {
      this.sorobanServer = new SorobanRpc.Server(sorobanUrl);
    }
  }

  /**
   * Get dynamic fee based on current network conditions
   * @param priorityLevel - Transaction priority level
   * @param isHighValue - Whether this is a high-value platform transaction
   */
  async getDynamicFee(
    priorityLevel: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    isHighValue: boolean = false,
  ): Promise<DynamicFeeConfig> {
    try {
      // Fetch current fee stats from Horizon
      const feeStats = await this.fetchFeeStats();
      
      // Calculate fee based on priority level
      let baseFee: number;
      let priorityFee: number;

      switch (priorityLevel) {
        case 'low':
          // Use 10th percentile - slower but cheaper
          baseFee = feeStats.p10;
          priorityFee = 0;
          break;
        case 'medium':
          // Use 50th percentile (median) - balanced
          baseFee = feeStats.p50;
          priorityFee = Math.ceil(baseFee * 0.2); // 20% priority boost
          break;
        case 'high':
          // Use 90th percentile - faster
          baseFee = feeStats.p90;
          priorityFee = Math.ceil(baseFee * 0.5); // 50% priority boost
          break;
        case 'urgent':
          // Use 99th percentile - fastest
          baseFee = feeStats.p99;
          priorityFee = Math.ceil(baseFee * 1.0); // 100% priority boost
          break;
        default:
          baseFee = feeStats.p50;
          priorityFee = Math.ceil(baseFee * 0.2);
      }

      // Auto-bid priority for high-value platform transactions
      if (isHighValue) {
        priorityFee = Math.ceil(priorityFee * 2); // Double priority fee for high-value txs
        this.logger.log('Applied high-value priority bidding');
      }

      const totalFee = baseFee + priorityFee;

      return {
        baseFee,
        priorityFee,
        totalFee,
        feeLevel: priorityLevel,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch dynamic fee: ${error.message}`);
      // Fallback to conservative fee estimation
      return this.getFallbackFee(priorityLevel, isHighValue);
    }
  }

  /**
   * Fetch current fee statistics from Horizon
   */
  private async fetchFeeStats(): Promise<FeeStats> {
    // Use cached stats if still valid
    const now = Date.now();
    if (this.cachedFeeStats && (now - this.lastFeeUpdate) < this.CACHE_DURATION) {
      return this.cachedFeeStats;
    }

    try {
      // Fetch fee stats from Horizon /fee_stats endpoint
      const horizonUrl = this.configService.get<string>(
        'stellar.horizonUrl',
        'https://horizon-testnet.stellar.org',
      );
      
      const response = await fetch(`${horizonUrl}/fee_stats`);
      if (!response.ok) {
        throw new Error(`Horizon fee_stats request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      this.cachedFeeStats = {
        min: parseInt(data.last_ledger.base_fee_in_stroops.min),
        max: parseInt(data.last_ledger.base_fee_in_stroops.max),
        mode: parseInt(data.last_ledger.base_fee_in_stroops.mode),
        p10: parseInt(data.last_ledger.base_fee_in_stroops.p10),
        p20: parseInt(data.last_ledger.base_fee_in_stroops.p20),
        p30: parseInt(data.last_ledger.base_fee_in_stroops.p30),
        p40: parseInt(data.last_ledger.base_fee_in_stroops.p40),
        p50: parseInt(data.last_ledger.base_fee_in_stroops.p50),
        p60: parseInt(data.last_ledger.base_fee_in_stroops.p60),
        p70: parseInt(data.last_ledger.base_fee_in_stroops.p70),
        p80: parseInt(data.last_ledger.base_fee_in_stroops.p80),
        p90: parseInt(data.last_ledger.base_fee_in_stroops.p90),
        p95: parseInt(data.last_ledger.base_fee_in_stroops.p95),
        p99: parseInt(data.last_ledger.base_fee_in_stroops.p99),
      };

      this.lastFeeUpdate = now;
      this.logger.debug(`Updated fee stats: mode=${this.cachedFeeStats.mode}, p50=${this.cachedFeeStats.p50}`);
      
      return this.cachedFeeStats;
    } catch (error) {
      this.logger.error(`Failed to fetch fee stats from Horizon: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fallback fee calculation when Horizon is unavailable
   */
  private getFallbackFee(
    priorityLevel: string,
    isHighValue: boolean,
  ): DynamicFeeConfig {
    // Conservative default: 10000 stroops (0.001 XLM)
    const defaultBaseFee = 10000;
    
    let multiplier = 1;
    switch (priorityLevel) {
      case 'low':
        multiplier = 0.5;
        break;
      case 'medium':
        multiplier = 1;
        break;
      case 'high':
        multiplier = 2;
        break;
      case 'urgent':
        multiplier = 5;
        break;
    }

    let baseFee = Math.ceil(defaultBaseFee * multiplier);
    let priorityFee = isHighValue ? baseFee : Math.ceil(baseFee * 0.2);

    if (isHighValue) {
      priorityFee *= 2;
    }

    return {
      baseFee,
      priorityFee,
      totalFee: baseFee + priorityFee,
      feeLevel: priorityLevel as any,
    };
  }

  /**
   * Get current network congestion level
   */
  async getNetworkCongestionLevel(): Promise<'low' | 'medium' | 'high' | 'critical'> {
    try {
      const feeStats = await this.fetchFeeStats();
      
      // Calculate congestion based on fee variance
      const congestionRatio = feeStats.p99 / feeStats.p10;
      
      if (congestionRatio > 10) {
        return 'critical';
      } else if (congestionRatio > 5) {
        return 'high';
      } else if (congestionRatio > 2) {
        return 'medium';
      } else {
        return 'low';
      }
    } catch (error) {
      this.logger.error('Failed to determine network congestion');
      return 'medium';
    }
  }

  /**
   * Clear cached fee stats (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cachedFeeStats = null;
    this.lastFeeUpdate = 0;
  }
}
