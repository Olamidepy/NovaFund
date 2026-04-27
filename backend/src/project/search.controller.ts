import { Controller, Get, Query } from '@nestjs/common';
import { SearchService, SearchResult } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('projects')
  async searchProjects(
    @Query('q') query: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('minGoal') minGoal?: number,
    @Query('maxGoal') maxGoal?: number,
  ): Promise<SearchResult[]> {
    return this.searchService.searchProjects({
      query,
      limit: limit ? parseInt(limit.toString()) : 20,
      offset: offset ? parseInt(offset.toString()) : 0,
      category,
      status,
      minGoal: minGoal ? parseFloat(minGoal.toString()) : undefined,
      maxGoal: maxGoal ? parseFloat(maxGoal.toString()) : undefined,
    });
  }

  @Get('suggest')
  async getSuggestions(
    @Query('prefix') prefix: string,
    @Query('limit') limit?: number,
  ): Promise<string[]> {
    return this.searchService.getSuggestions(
      prefix,
      limit ? parseInt(limit.toString()) : 10,
    );
  }
}
