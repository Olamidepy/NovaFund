import { Field, ObjectType, InputType, Float, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

/**
 * Represents a single asset swap route option
 */
@ObjectType('SwapRoute')
export class SwapRouteDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  sourceAssetCode: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sourceAssetIssuer?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  destinationAssetCode: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  destinationAssetIssuer: string;

  @Field(() => Float)
  @IsNumber()
  sourceAmount: number;

  @Field(() => Float)
  @IsNumber()
  destinationAmount: number;

  @Field(() => Float)
  @IsNumber()
  feePercentage: number;

  @Field(() => Float)
  @IsNumber()
  conversionRate: number;

  @Field(() => Int)
  hopCount: number;

  @Field()
  isOptimal: boolean;

  @Field()
  recommendation: string;

  @Field()
  timestamp: Date;
}

/**
 * Request to find swap routes for an investment
 */
@InputType('FindSwapRoutesInput')
export class FindSwapRoutesInputDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  userAssetCode: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userAssetIssuer?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectAssetCode: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectAssetIssuer: string;

  @Field(() => Float)
  @IsNumber()
  @IsNotEmpty()
  investmentAmount: number;

  @Field(() => Int, { nullable: true, defaultValue: 3 })
  @IsOptional()
  @IsNumber()
  pathCount?: number;
}

/**
 * Response containing swap route analysis
 */
@ObjectType('SwapRouteAnalysis')
export class SwapRouteAnalysisDto {
  @Field(() => SwapRouteDto)
  bestRoute: SwapRouteDto;

  @Field(() => [SwapRouteDto])
  alternativeRoutes: SwapRouteDto[];

  @Field()
  recommendation: string;

  @Field(() => Float)
  avgFeePercentage: number;

  @Field(() => Float)
  bestConversionRate: number;

  @Field(() => Float)
  worstConversionRate: number;
}

/**
 * Represents an investment intent with proposed routing
 */
@ObjectType('InvestmentIntent')
export class InvestmentIntentDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  investorId: string;

  @Field(() => Float)
  @IsNumber()
  investmentAmount: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  userAssetCode: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userAssetIssuer?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectAssetCode: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectAssetIssuer: string;

  @Field(() => SwapRouteAnalysisDto)
  proposedRoute: SwapRouteAnalysisDto;

  @Field()
  status: InvestmentIntentStatus;

  @Field()
  expiresAt: Date;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  @IsOptional()
  executedAt?: Date;
}

/**
 * Create Investment Intent input
 */
@InputType('CreateInvestmentIntentInput')
export class CreateInvestmentIntentInputDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  investorId: string;

  @Field(() => Float)
  @IsNumber()
  investmentAmount: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  userAssetCode: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userAssetIssuer?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectAssetCode: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  projectAssetIssuer: string;

  @Field(() => Int, { nullable: true, defaultValue: 300 })
  @IsOptional()
  @IsNumber()
  validitySeconds?: number;
}

/**
 * Status of an investment intent
 */
export enum InvestmentIntentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

/**
 * Accept/Reject investment intent
 */
@InputType('UpdateInvestmentIntentInput')
export class UpdateInvestmentIntentInputDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  intentId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  status: InvestmentIntentStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
