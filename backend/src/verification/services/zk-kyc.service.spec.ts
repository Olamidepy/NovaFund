import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ZkKycService } from './zk-kyc.service';
import { PrismaService } from '../../prisma.service';

describe('ZkKycService', () => {
  let service: ZkKycService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    kycAuditEntity: {
      save: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'VIOLET_API_KEY': 'test_violet_key',
        'GALXE_API_KEY': 'test_galxe_key',
        'APP_URL': 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZkKycService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ZkKycService>(ZkKycService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return supported providers', () => {
    const providers = service.getSupportedProviders();
    expect(providers).toContain('violet');
    expect(providers).toContain('galxe');
  });

  it('should throw error for unsupported provider', async () => {
    await expect(
      service.initiateVerification('user-123', 'unsupported' as any),
    ).rejects.toThrow('Unsupported ZK-KYC provider');
  });
});