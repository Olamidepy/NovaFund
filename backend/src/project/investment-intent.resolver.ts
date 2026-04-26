import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { InvestmentIntentService } from './investment-intent.service';
import {
  InvestmentIntentDto,
  CreateInvestmentIntentInputDto,
  UpdateInvestmentIntentInputDto,
  InvestmentIntentStatus,
} from './dto/investment-intent.dto';

@Resolver(() => InvestmentIntentDto)
export class InvestmentIntentResolver {
  constructor(private readonly investmentIntentService: InvestmentIntentService) {}

  /**
   * Create a new investment intent with smart order routing
   */
  @Mutation(() => InvestmentIntentDto, { name: 'createInvestmentIntent' })
  async createInvestmentIntent(
    @Args('input') input: CreateInvestmentIntentInputDto,
  ): Promise<InvestmentIntentDto> {
    return this.investmentIntentService.createInvestmentIntent(input);
  }

  /**
   * Get a specific investment intent
   */
  @Query(() => InvestmentIntentDto, { name: 'investmentIntent' })
  async getInvestmentIntent(@Args('id') id: string): Promise<InvestmentIntentDto> {
    return this.investmentIntentService.getInvestmentIntent(id);
  }

  /**
   * List investment intents with optional filtering
   */
  @Throttle({ aggregate: { ttl: 60_000, limit: 20 } })
  @Query(() => [InvestmentIntentDto], { name: 'investmentIntents' })
  async listInvestmentIntents(
    @Args('projectId', { type: () => String, nullable: true }) projectId?: string,
    @Args('investorId', { type: () => String, nullable: true }) investorId?: string,
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset?: number,
  ): Promise<InvestmentIntentDto[]> {
    const filters = {
      projectId,
      investorId,
      status: status ? (status as InvestmentIntentStatus) : undefined,
      limit,
      offset,
    };
    const result = await this.investmentIntentService.listInvestmentIntents(filters);
    return result.intents;
  }

  /**
   * Approve an investment intent to proceed with funding
   */
  @Mutation(() => InvestmentIntentDto, { name: 'approveInvestmentIntent' })
  async approveInvestmentIntent(@Args('id') id: string): Promise<InvestmentIntentDto> {
    return this.investmentIntentService.approveInvestmentIntent(id);
  }

  /**
   * Reject an investment intent with optional reason
   */
  @Mutation(() => InvestmentIntentDto, { name: 'rejectInvestmentIntent' })
  async rejectInvestmentIntent(
    @Args('id') id: string,
    @Args('reason', { type: () => String, nullable: true }) reason?: string,
  ): Promise<InvestmentIntentDto> {
    return this.investmentIntentService.rejectInvestmentIntent(id, reason);
  }
}
