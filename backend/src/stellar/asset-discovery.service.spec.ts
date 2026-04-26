import { Test, TestingModule } from '@nestjs/testing';
import { AssetDiscoveryService } from './asset-discovery.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { RpcFallbackService } from './rpc-fallback.service';

describe('AssetDiscoveryService', () => {
  let service: AssetDiscoveryService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetDiscoveryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'ASSET_DISCOVERY_MIN_LIQUIDITY_SCORE': '7.5',
                'ASSET_DISCOVERY_MIN_VOLUME_24H': '10000000000',
                'ASSET_DISCOVERY_MIN_HOLDERS_COUNT': '100',
                'ASSET_DISCOVERY_REQUIRED_TAGS': 'RWA,Stable',
                'ASSET_DISCOVERY_SCAN_INTERVAL_HOURS': '24',
                'ASSET_DISCOVERY_MAX_ASSETS_PER_SCAN': '100',
                'ASSET_DISCOVERY_HOME_DOMAIN_TIMEOUT': '5000',
                'STELLAR_HORIZON_URL': 'https://horizon-testnet.stellar.org',
              };
              return config[key];
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            discoveredAsset: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            whitelistedAsset: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: RpcFallbackService,
          useValue: {
            // Mock RPC service methods if needed
          },
        },
      ],
    }).compile();

    service = module.get<AssetDiscoveryService>(AssetDiscoveryService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfiguration', () => {
    it('should return service configuration', () => {
      const config = service.getConfiguration();

      expect(config).toBeDefined();
      expect(config.minLiquidityScore).toBe(7.5);
      expect(config.requiredTags).toEqual(['RWA', 'Stable']);
    });
  });

  describe('manualAssetScan', () => {
    it('should perform manual asset scan', async () => {
      // Mock the scan methods
      jest.spyOn(service as any, 'performAssetScan').mockResolvedValue([]);
      jest.spyOn(service as any, 'filterNewAssets').mockResolvedValue([]);
      jest.spyOn(service as any, 'proposeAssetsForReview').mockResolvedValue([]);

      const result = await service.manualAssetScan();

      expect(result).toEqual({
        discovered: 0,
        new: 0,
        proposed: 0,
      });
    });
  });

  describe('approveAsset', () => {
    it('should approve and whitelist an asset', async () => {
      const mockAsset = {
        id: 'asset-123',
        assetCode: 'USDC',
        assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        assetType: 'CREDIT_ALPHANUM4',
        homeDomain: 'centre.io',
        tomlInfo: {},
        tags: ['Stable'],
        liquidityScore: 9.5,
        volume24h: BigInt(100000000000),
        holdersCount: 10000,
        trustlinesCount: 10000,
        status: 'DISCOVERED',
      };

      jest.spyOn(prismaService.discoveredAsset, 'findUnique').mockResolvedValue(mockAsset);
      jest.spyOn(prismaService.whitelistedAsset, 'create').mockResolvedValue({} as any);
      jest.spyOn(prismaService.discoveredAsset, 'update').mockResolvedValue({} as any);

      await expect(service.approveAsset('asset-123', 'admin-456', 'STABLECOIN', 'LOW')).resolves.not.toThrow();
    });

    it('should throw error for non-existent asset', async () => {
      jest.spyOn(prismaService.discoveredAsset, 'findUnique').mockResolvedValue(null);

      await expect(service.approveAsset('non-existent', 'admin-456', 'STABLECOIN', 'LOW'))
        .rejects.toThrow('Asset not found');
    });
  });

  describe('rejectAsset', () => {
    it('should reject an asset', async () => {
      const mockAsset = {
        id: 'asset-123',
        status: 'DISCOVERED',
      };

      jest.spyOn(prismaService.discoveredAsset, 'findUnique').mockResolvedValue(mockAsset);
      jest.spyOn(prismaService.discoveredAsset, 'update').mockResolvedValue({} as any);

      await expect(service.rejectAsset('asset-123', 'admin-456', 'Insufficient liquidity'))
        .resolves.not.toThrow();
    });
  });

  describe('getWhitelistedAssets', () => {
    it('should return whitelisted assets', async () => {
      const mockAssets = [
        {
          id: 'whitelist-123',
          assetCode: 'USDC',
          isActive: true,
        },
      ];

      jest.spyOn(prismaService.whitelistedAsset, 'findMany').mockResolvedValue(mockAssets);

      const result = await service.getWhitelistedAssets(true);

      expect(result).toEqual(mockAssets);
    });
  });

  describe('liquidity score calculation', () => {
    it('should calculate liquidity score correctly', () => {
      const serviceAny = service as any;

      // High volume, high trades, high holders = high score
      const stats1 = {
        volume: BigInt(100000000000), // 10,000 XLM
        trades: 200,
        lastActivity: new Date(),
        holders: new Set(),
      };
      const score1 = serviceAny.calculateLiquidityScore(stats1, { num_accounts: 2000 });
      expect(score1).toBeGreaterThan(8);

      // Low volume, low trades, low holders = low score
      const stats2 = {
        volume: BigInt(1000000000), // 100 XLM
        trades: 5,
        lastActivity: new Date(),
        holders: new Set(),
      };
      const score2 = serviceAny.calculateLiquidityScore(stats2, { num_accounts: 10 });
      expect(score2).toBeLessThan(3);
    });
  });

  describe('tag extraction', () => {
    it('should extract tags from TOML info', () => {
      const serviceAny = service as any;

      const tomlInfo = {
        CURRENCIES: [
          {
            code: 'USDC',
            name: 'USD Coin',
            desc: 'A fully collateralized US Dollar stablecoin',
            tags: ['stablecoin', 'usd'],
          },
        ],
      };

      const tags = serviceAny.extractTagsFromToml(tomlInfo, {});
      expect(tags).toContain('stablecoin');
      expect(tags).toContain('usd');
      expect(tags).toContain('Stable'); // Added from description
    });
  });
});