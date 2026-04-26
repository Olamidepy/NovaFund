import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StellarService } from './stellar.service';
import { PriceOracleService } from '../oracle/price-oracle.service';
import { Asset } from '@stellar/stellar-sdk';

export interface ReserveWallet {
  assetCode: string;
  issuer?: string;
  targetRatio: number; // e.g., 0.4 for 40%
  currentBalance?: number;
  currentValueUsd?: number;
  walletAddress: string; // The public key of the wallet holding this asset
  secretKey?: string; // The secret key for signing transactions (optional for read-only)
}

@Injectable()
export class ReservesService {
  private readonly logger = new Logger(ReservesService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly stellarService: StellarService,
    private readonly priceOracle: PriceOracleService,
  ) {}

  /**
   * Main rebalancing logic
   * Triggered automatically every day at midnight, or can be called manually
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkAndRebalance(): Promise<void> {
    this.logger.log('Starting automated treasury rebalancing check...');

    try {
      const treasuryConfig = this.configService.get('stellar.treasury');
      const wallets: ReserveWallet[] = treasuryConfig.wallets;
      const threshold = treasuryConfig.rebalanceThreshold;

      // 1. Fetch current balances from each wallet
      let totalValueUsd = 0;
      const updatedWallets: ReserveWallet[] = [];

      for (const wallet of wallets) {
        if (!wallet.walletAddress) {
          this.logger.warn(`Wallet address not provided for ${wallet.assetCode}, skipping`);
          continue;
        }

        const balances = await this.stellarService.getBalances(wallet.walletAddress);
        
        const balanceLine = balances.find((b: any) => {
          if (wallet.assetCode === 'XLM') return b.asset_type === 'native';
          return b.asset_code === wallet.assetCode && b.asset_issuer === (wallet.issuer || this.getIssuerForAsset(wallet.assetCode));
        });

        const balance = balanceLine ? parseFloat(balanceLine.balance) : 0;
        const priceResult = await this.priceOracle.getLatestPrice(wallet.assetCode);
        const price = priceResult ? priceResult.price : (wallet.assetCode === 'USDC' || wallet.assetCode === 'EURC' ? 1 : 0);
        
        const valueUsd = balance * price;
        totalValueUsd += valueUsd;

        updatedWallets.push({
          ...wallet,
          currentBalance: balance,
          currentValueUsd: valueUsd,
        });
      }

      this.logger.log(`Total treasury value: $${totalValueUsd.toFixed(2)}`);

      // 3. Check for deviations
      const rebalanceActions: { wallet: ReserveWallet; diffUsd: number }[] = [];

      for (const wallet of updatedWallets) {
        const currentRatio = wallet.currentValueUsd / totalValueUsd;
        const deviation = Math.abs(currentRatio - wallet.targetRatio);

        if (deviation > threshold) {
          const targetValueUsd = totalValueUsd * wallet.targetRatio;
          const diffUsd = targetValueUsd - wallet.currentValueUsd;
          rebalanceActions.push({ wallet, diffUsd });
          this.logger.warn(
            `Asset ${wallet.assetCode} deviated by ${(deviation * 100).toFixed(2)}% ` +
            `(Target: ${wallet.targetRatio * 100}%, Current: ${(currentRatio * 100).toFixed(2)}%)`
          );
        }
      }

      if (rebalanceActions.length === 0) {
        this.logger.log('Treasury is within target ratios. No rebalancing needed.');
        return;
      }

      // 4. Execute rebalancing swaps
      // For simplicity, we'll swap from assets with surplus to assets with deficit
      // A more robust implementation would optimize path selection
      await this.executeRebalance(rebalanceActions);

    } catch (error) {
      this.logger.error(`Rebalancing failed: ${error.message}`, error.stack);
    }
  }

  private async executeRebalance(actions: { wallet: ReserveWallet; diffUsd: number }[]): Promise<void> {
    const surplus = actions.filter(a => a.diffUsd < 0).sort((a, b) => a.diffUsd - b.diffUsd);
    const deficit = actions.filter(a => a.diffUsd > 0).sort((a, b) => b.diffUsd - a.diffUsd);

    for (const d of deficit) {
      // Find a surplus asset to swap from
      const s = surplus[0];
      if (!s) break;

      const swapAmountUsd = Math.min(Math.abs(s.diffUsd), d.diffUsd);
      
      const sPrice = (await this.priceOracle.getLatestPrice(s.wallet.assetCode))?.price || 1;
      const amountToSwap = (swapAmountUsd / sPrice).toFixed(7);

      const sourceAsset = this.constructAsset(s.wallet.assetCode, s.wallet.issuer);
      const destAsset = this.constructAsset(d.wallet.assetCode, d.wallet.issuer);

      this.logger.log(`Rebalancing: Swapping ${amountToSwap} ${s.wallet.assetCode} for ${d.wallet.assetCode}`);
      
      try {
        await this.stellarService.executeSwap(
          sourceAsset, 
          destAsset, 
          amountToSwap,
          s.wallet.walletAddress,
          s.wallet.secretKey
        );
        
        // Update remaining diffs
        s.diffUsd += swapAmountUsd;
        d.diffUsd -= swapAmountUsd;
        
        if (Math.abs(s.diffUsd) < 1) surplus.shift(); // Remove if surplus is mostly cleared
      } catch (error) {
        this.logger.error(`Failed to swap ${s.wallet.assetCode} to ${d.wallet.assetCode}: ${error.message}`);
      }
    }
  }

  private getIssuerForAsset(code: string): string | undefined {
    if (code === 'USDC') return this.configService.get('stellar.usdcIssuer');
    if (code === 'EURC') return this.configService.get('stellar.eurcIssuer');
    return undefined;
  }

  private constructAsset(code: string, issuer?: string): Asset {
    if (code === 'XLM' || !issuer) return Asset.native();
    return new Asset(code, issuer || this.getIssuerForAsset(code)!);
  }
}
