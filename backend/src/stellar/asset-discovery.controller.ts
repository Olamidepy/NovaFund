import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AssetDiscoveryService } from '../asset-discovery.service';
import {
  ManualScanDto,
  GetPendingAssetsDto,
  ApproveAssetDto,
  RejectAssetDto,
  UpdateAssetDto,
  AssetDiscoveryStatsDto,
  DiscoveredAssetResponseDto,
  WhitelistedAssetResponseDto,
  ManualScanResponseDto,
} from './dto/asset-discovery.dto';
import { AdminGuard } from '../../guards/admin.guard';

@Controller('stellar/assets')
@UseGuards(AdminGuard)
export class AssetDiscoveryController {
  constructor(private readonly assetDiscoveryService: AssetDiscoveryService) {}

  /**
   * Get asset discovery statistics
   */
  @Get('stats')
  async getStats(): Promise<AssetDiscoveryStatsDto> {
    const [
      totalDiscovered,
      pendingReview,
      whitelisted,
      rejected,
    ] = await Promise.all([
      this.assetDiscoveryService.getDiscoveredAssetCount(),
      this.assetDiscoveryService.getPendingAssetCount(),
      this.assetDiscoveryService.getWhitelistedAssetCount(),
      this.assetDiscoveryService.getRejectedAssetCount(),
    ]);

    return {
      totalDiscovered,
      pendingReview,
      whitelisted,
      rejected,
      lastScanAt: await this.assetDiscoveryService.getLastScanTime(),
      nextScanAt: await this.assetDiscoveryService.getNextScanTime(),
    };
  }

  /**
   * Manually trigger asset discovery scan
   */
  @Post('scan')
  @Throttle({ default: { ttl: 3600_000, limit: 3 } }) // 3 manual scans per hour max
  @HttpCode(HttpStatus.OK)
  async manualScan(@Body() dto: ManualScanDto): Promise<ManualScanResponseDto> {
    const result = await this.assetDiscoveryService.manualAssetScan(dto.maxAssets);

    return {
      ...result,
      timestamp: new Date(),
    };
  }

  /**
   * Get pending assets for review
   */
  @Get('pending')
  async getPendingAssets(@Query() query: GetPendingAssetsDto): Promise<DiscoveredAssetResponseDto[]> {
    const assets = await this.assetDiscoveryService.getPendingAssets(query.limit, query.offset);

    return assets.map(asset => ({
      id: asset.id,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer,
      assetType: asset.assetType,
      homeDomain: asset.homeDomain,
      tomlInfo: asset.tomlInfo,
      tags: asset.tags,
      liquidityScore: Number(asset.liquidityScore),
      volume24h: asset.volume24h.toString(),
      holdersCount: asset.holdersCount,
      trustlinesCount: asset.trustlinesCount,
      lastActivity: asset.lastActivity,
      status: asset.status,
      proposedBy: asset.proposedBy,
      createdAt: asset.createdAt,
    }));
  }

  /**
   * Get specific discovered asset details
   */
  @Get('discovered/:assetId')
  async getDiscoveredAsset(@Param('assetId') assetId: string): Promise<DiscoveredAssetResponseDto> {
    const asset = await this.assetDiscoveryService.getDiscoveredAsset(assetId);

    return {
      id: asset.id,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer,
      assetType: asset.assetType,
      homeDomain: asset.homeDomain,
      tomlInfo: asset.tomlInfo,
      tags: asset.tags,
      liquidityScore: Number(asset.liquidityScore),
      volume24h: asset.volume24h.toString(),
      holdersCount: asset.holdersCount,
      trustlinesCount: asset.trustlinesCount,
      lastActivity: asset.lastActivity,
      status: asset.status,
      proposedBy: asset.proposedBy,
      createdAt: asset.createdAt,
    };
  }

  /**
   * Approve asset for whitelisting
   */
  @Post(':assetId/approve')
  @HttpCode(HttpStatus.OK)
  async approveAsset(
    @Param('assetId') assetId: string,
    @Body() dto: ApproveAssetDto,
  ): Promise<{ message: string }> {
    await this.assetDiscoveryService.approveAsset(
      assetId,
      dto.assetId, // This should be adminId from auth context
      dto.category,
      dto.riskLevel,
      dto.reviewNotes,
    );

    return { message: 'Asset approved and whitelisted successfully' };
  }

  /**
   * Reject asset
   */
  @Post(':assetId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectAsset(
    @Param('assetId') assetId: string,
    @Body() dto: RejectAssetDto,
  ): Promise<{ message: string }> {
    await this.assetDiscoveryService.rejectAsset(
      assetId,
      dto.assetId, // This should be adminId from auth context
      dto.rejectionReason,
    );

    return { message: 'Asset rejected successfully' };
  }

  /**
   * Get all whitelisted assets
   */
  @Get('whitelisted')
  async getWhitelistedAssets(@Query('activeOnly') activeOnly?: string): Promise<WhitelistedAssetResponseDto[]> {
    const active = activeOnly !== 'false';
    const assets = await this.assetDiscoveryService.getWhitelistedAssets(active);

    return assets.map(asset => ({
      id: asset.id,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer,
      assetType: asset.assetType,
      homeDomain: asset.homeDomain,
      tomlInfo: asset.tomlInfo,
      tags: asset.tags,
      category: asset.category,
      riskLevel: asset.riskLevel,
      isActive: asset.isActive,
      maxInvestment: asset.maxInvestment?.toString(),
      minInvestment: asset.minInvestment?.toString(),
      whitelistedBy: asset.whitelistedBy,
      whitelistedAt: asset.whitelistedAt,
      lastReviewedAt: asset.lastReviewedAt,
      reviewNotes: asset.reviewNotes,
    }));
  }

  /**
   * Get specific whitelisted asset
   */
  @Get('whitelisted/:assetId')
  async getWhitelistedAsset(@Param('assetId') assetId: string): Promise<WhitelistedAssetResponseDto> {
    const asset = await this.assetDiscoveryService.getWhitelistedAsset(assetId);

    return {
      id: asset.id,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer,
      assetType: asset.assetType,
      homeDomain: asset.homeDomain,
      tomlInfo: asset.tomlInfo,
      tags: asset.tags,
      category: asset.category,
      riskLevel: asset.riskLevel,
      isActive: asset.isActive,
      maxInvestment: asset.maxInvestment?.toString(),
      minInvestment: asset.minInvestment?.toString(),
      whitelistedBy: asset.whitelistedBy,
      whitelistedAt: asset.whitelistedAt,
      lastReviewedAt: asset.lastReviewedAt,
      reviewNotes: asset.reviewNotes,
    };
  }

  /**
   * Update whitelisted asset settings
   */
  @Put('whitelisted/:assetId')
  @HttpCode(HttpStatus.OK)
  async updateWhitelistedAsset(
    @Param('assetId') assetId: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<{ message: string }> {
    await this.assetDiscoveryService.updateWhitelistedAsset(assetId, dto);

    return { message: 'Asset updated successfully' };
  }

  /**
   * Deactivate whitelisted asset
   */
  @Delete('whitelisted/:assetId')
  @HttpCode(HttpStatus.OK)
  async deactivateAsset(@Param('assetId') assetId: string): Promise<{ message: string }> {
    await this.assetDiscoveryService.deactivateWhitelistedAsset(assetId);

    return { message: 'Asset deactivated successfully' };
  }

  /**
   * Get asset discovery configuration
   */
  @Get('config')
  async getConfig(): Promise<any> {
    return this.assetDiscoveryService.getConfiguration();
  }
}