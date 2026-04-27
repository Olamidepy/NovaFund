import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from '@stellar/stellar-sdk';
import { DynamicFeeService } from './dynamic-fee.service';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private horizonServer: Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sponsorKeypair: Keypair;

  constructor(
    private readonly configService: ConfigService,
    private readonly dynamicFeeService: DynamicFeeService,
  ) {
    const horizonUrl = this.configService.get<string>(
      'stellar.horizonUrl',
      'https://horizon-testnet.stellar.org',
    );
    this.networkPassphrase = this.configService.get<string>(
      'stellar.networkPassphrase',
      Networks.TESTNET,
    );
    const sponsorSecret = this.configService.get<string>('stellar.sponsorSecretKey');

    this.horizonServer = new Horizon.Server(horizonUrl);
    
    if (sponsorSecret) {
      this.sponsorKeypair = Keypair.fromSecret(sponsorSecret);
      this.logger.log(`StellarService initialized with sponsor: ${this.sponsorKeypair.publicKey()}`);
    } else {
      this.logger.warn('StellarService initialized without sponsor secret key');
    }
  }

  /**
   * Process a refund to a user
   * @param userId - ID of the user (or their wallet address if stored as such)
   * @param amount - Amount in stroops
   */
  async processRefund(
    userId: string,
    amount: string | bigint,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  ): Promise<void> {
    this.logger.log(`Processing refund for user ${userId}, amount: ${amount}`);
    
    const userAddress = userId;

    try {
      // Get dynamic fee based on network conditions
      const feeConfig = await this.dynamicFeeService.getDynamicFee(priority, false);
      
      const account = await this.horizonServer.loadAccount(this.sponsorKeypair.publicKey());
      const transaction = new TransactionBuilder(account, {
        fee: feeConfig.totalFee.toString(), // Use dynamic fee instead of BASE_FEE
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: userAddress,
            asset: Asset.native(),
            amount: (Number(amount) / 10_000_000).toString(),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(this.sponsorKeypair);
      await this.horizonServer.submitTransaction(transaction);
      this.logger.log(`Refund successful for user ${userId} with fee: ${feeConfig.totalFee} stroops`);
    } catch (error) {
      this.logger.error(`Refund failed for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Get balances for a specific wallet address
   * @param walletAddress - The public key of the wallet to query
   */
  async getBalances(walletAddress?: string): Promise<any[]> {
    const address = walletAddress || this.sponsorKeypair.publicKey();
    const account = await this.horizonServer.loadAccount(address);
    return account.balances;
  }

  /**
   * Execute a path payment (swap) for rebalancing
   * @param sourceAsset - The asset to swap from
   * @param destAsset - The asset to swap to
   * @param amount - The amount to swap
   * @param walletAddress - The wallet address to perform the swap from (defaults to sponsor)
   * @param secretKey - The secret key for signing (defaults to sponsor)
   * @param isHighValue - Whether this is a high-value transaction requiring priority
   */
  async executeSwap(
    sourceAsset: Asset,
    destAsset: Asset,
    amount: string,
    walletAddress?: string,
    secretKey?: string,
    isHighValue: boolean = false,
  ): Promise<void> {
    this.logger.log(`Executing swap: ${amount} ${sourceAsset.code} -> ${destAsset.code}`);
    
    try {
      const address = walletAddress || this.sponsorKeypair.publicKey();
      const keypair = secretKey ? Keypair.fromSecret(secretKey) : this.sponsorKeypair;
      
      const account = await this.horizonServer.loadAccount(address);
      
      // Get dynamic fee with priority bidding for high-value transactions
      const priority = isHighValue ? 'urgent' : 'high';
      const feeConfig = await this.dynamicFeeService.getDynamicFee(priority, isHighValue);
      
      const transaction = new TransactionBuilder(account, {
        fee: feeConfig.totalFee.toString(), // Use dynamic fee
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.pathPaymentStrictSend({
            sendAsset: sourceAsset,
            sendAmount: amount,
            destination: address,
            destAsset: destAsset,
            destMin: '0.0000001',
            path: [],
          }),
        )
        .setTimeout(60)
        .build();

      transaction.sign(keypair);
      await this.horizonServer.submitTransaction(transaction);
      this.logger.log(`Swap executed successfully with fee: ${feeConfig.totalFee} stroops`);
    } catch (error) {
      this.logger.error(`Swap failed: ${error.message}`);
      throw new InternalServerErrorException(`Failed to execute swap: ${error.message}`);
    }
  }
}
