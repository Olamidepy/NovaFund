import { IsString, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ManualScanDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxAssets?: number;
}

export class GetPendingAssetsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class ApproveAssetDto {
  @IsString()
  @IsUUID()
  assetId: string;

  @IsEnum(['STABLECOIN', 'RWA', 'DEFI', 'UTILITY', 'MEME', 'OTHER'])
  category: 'STABLECOIN' | 'RWA' | 'DEFI' | 'UTILITY' | 'MEME' | 'OTHER';

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxInvestment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minInvestment?: number;
}

export class RejectAssetDto {
  @IsString()
  @IsUUID()
  assetId: string;

  @IsString()
  rejectionReason: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsEnum(['STABLECOIN', 'RWA', 'DEFI', 'UTILITY', 'MEME', 'OTHER'])
  category?: 'STABLECOIN' | 'RWA' | 'DEFI' | 'UTILITY' | 'MEME' | 'OTHER';

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxInvestment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minInvestment?: number;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class AssetDiscoveryStatsDto {
  totalDiscovered: number;
  pendingReview: number;
  whitelisted: number;
  rejected: number;
  lastScanAt?: Date;
  nextScanAt?: Date;
}

export class DiscoveredAssetResponseDto {
  id: string;
  assetCode: string;
  assetIssuer?: string;
  assetType: string;
  homeDomain?: string;
  tomlInfo?: any;
  tags: string[];
  liquidityScore: number;
  volume24h: string;
  holdersCount: number;
  trustlinesCount: number;
  lastActivity?: Date;
  status: string;
  proposedBy?: string;
  createdAt: Date;
}

export class WhitelistedAssetResponseDto {
  id: string;
  assetCode: string;
  assetIssuer?: string;
  assetType: string;
  homeDomain?: string;
  tomlInfo?: any;
  tags: string[];
  category: string;
  riskLevel: string;
  isActive: boolean;
  maxInvestment?: string;
  minInvestment?: string;
  whitelistedBy: string;
  whitelistedAt: Date;
  lastReviewedAt?: Date;
  reviewNotes?: string;
}

export class ManualScanResponseDto {
  discovered: number;
  new: number;
  proposed: number;
  timestamp: Date;
}