import { registerAs } from '@nestjs/config';

export interface StellarNetworkConfig {
  network: string;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  sponsorSecretKey: string;
  projectLaunchContractId: string;
  escrowContractId: string;
  profitDistributionContractId?: string;
  subscriptionPoolContractId?: string;
  governanceContractId?: string;
  reputationContractId?: string;
  usdcContractId?: string;
  eurcContractId?: string;
}

export interface IndexerConfig {
  pollIntervalMs: number;
  startLedger?: number;
  reorgDepthThreshold: number;
  maxEventsPerFetch: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export default registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  sponsorSecretKey: process.env.STELLAR_SPONSOR_SECRET_KEY || '',
  projectLaunchContractId: process.env.PROJECT_LAUNCH_CONTRACT_ID || '',
  escrowContractId: process.env.ESCROW_CONTRACT_ID || '',
  profitDistributionContractId: process.env.PROFIT_DISTRIBUTION_CONTRACT_ID,
  subscriptionPoolContractId: process.env.SUBSCRIPTION_POOL_CONTRACT_ID,
  governanceContractId: process.env.GOVERNANCE_CONTRACT_ID,
  reputationContractId: process.env.REPUTATION_CONTRACT_ID,
  usdcContractId: process.env.STELLAR_USDC_CONTRACT_ID,
  eurcContractId: process.env.STELLAR_EURC_CONTRACT_ID,
  usdcIssuer: process.env.STELLAR_USDC_ISSUER || 'GBBD67V63DU7C7H7FDUO77Z6YBXCH22YJ6Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7', // Placeholder
  eurcIssuer: process.env.STELLAR_EURC_ISSUER || 'GDBI67V63DU7C7H7FDUO77Z6YBXCH22YJ6Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7', // Placeholder
  treasury: {
    rebalanceThreshold: 0.05, // 5% deviation triggers rebalance
    wallets: [
      { 
        assetCode: 'XLM', 
        targetRatio: 0.4, // 40% XLM
        walletAddress: process.env.TREASURY_XLM_WALLET_ADDRESS || '',
        secretKey: process.env.TREASURY_XLM_SECRET_KEY || '',
      },
      { 
        assetCode: 'USDC', 
        targetRatio: 0.4, // 40% USDC
        walletAddress: process.env.TREASURY_USDC_WALLET_ADDRESS || '',
        secretKey: process.env.TREASURY_USDC_SECRET_KEY || '',
        issuer: process.env.STELLAR_USDC_ISSUER || 'GBBD67V63DU7C7H7FDUO77Z6YBXCH22YJ6Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7',
      },
      { 
        assetCode: 'EURC', 
        targetRatio: 0.2, // 20% EURC
        walletAddress: process.env.TREASURY_EURC_WALLET_ADDRESS || '',
        secretKey: process.env.TREASURY_EURC_SECRET_KEY || '',
        issuer: process.env.STELLAR_EURC_ISSUER || 'GDBI67V63DU7C7H7FDUO77Z6YBXCH22YJ6Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7Y7',
      },
    ],
  },
}));

export const indexerConfig = registerAs('indexer', () => ({
  pollIntervalMs: parseInt(process.env.INDEXER_POLL_INTERVAL_MS || '5000', 10),
  startLedger: process.env.INDEXER_START_LEDGER
    ? parseInt(process.env.INDEXER_START_LEDGER, 10)
    : undefined,
  reorgDepthThreshold: parseInt(process.env.INDEXER_REORG_DEPTH_THRESHOLD || '5', 10),
  maxEventsPerFetch: parseInt(process.env.INDEXER_MAX_EVENTS_PER_FETCH || '100', 10),
  retryAttempts: parseInt(process.env.INDEXER_RETRY_ATTEMPTS || '3', 10),
  retryDelayMs: parseInt(process.env.INDEXER_RETRY_DELAY_MS || '1000', 10),
}));
