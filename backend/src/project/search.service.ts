import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  goal: number;
  currentFunds: number;
  creatorId: string;
  score: number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  category?: string;
  status?: string;
  minGoal?: number;
  maxGoal?: number;
}

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private readonly isEnabled: boolean;
  private readonly elasticsearchUrl: string;
  private readonly indexName: string;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isEnabled = this.configService.get<string>('ELASTICSEARCH_ENABLED', 'false') === 'true';
    this.elasticsearchUrl = this.configService.get<string>(
      'ELASTICSEARCH_URL',
      'http://localhost:9200',
    );
    this.indexName = this.configService.get<string>('ELASTICSEARCH_INDEX', 'projects');
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.log('Elasticsearch is disabled. Using PostgreSQL fallback.');
      return;
    }

    this.logger.log('Initializing Elasticsearch connection...');
    // Initialize index if it doesn't exist
    await this.initializeIndex();
    
    // Start periodic sync every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncProjectsToElasticsearch();
    }, 5 * 60 * 1000);
  }

  async onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  /**
   * Main search function with fuzzy matching and relevance scoring
   */
  async searchProjects(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isEnabled) {
      this.logger.debug('Using PostgreSQL fallback search');
      return this.searchWithPostgreSQL(options);
    }

    try {
      return await this.searchWithElasticsearch(options);
    } catch (error) {
      this.logger.error(`Elasticsearch search failed: ${error.message}`);
      this.logger.warn('Falling back to PostgreSQL search');
      return this.searchWithPostgreSQL(options);
    }
  }

  /**
   * Elasticsearch-based search with fuzzy matching and multi-language support
   */
  private async searchWithElasticsearch(options: SearchOptions): Promise<SearchResult[]> {
    const { query, limit = 20, offset = 0, category, status, minGoal, maxGoal } = options;

    // Build Elasticsearch query
    const esQuery: any = {
      index: this.indexName,
      from: offset,
      size: limit,
      body: {
        query: {
          bool: {
            must: [],
            filter: [],
          },
        },
        highlight: {
          fields: {
            title: {},
            description: {},
          },
        },
      },
    };

    // Fuzzy search on title and description
    if (query) {
      esQuery.body.query.bool.must.push({
        multi_match: {
          query,
          fields: ['title^3', 'description^1'], // Title has higher weight
          fuzziness: 'AUTO', // Auto fuzziness for typo tolerance
          operator: 'or',
        },
      });
    }

    // Filters
    if (category) {
      esQuery.body.query.bool.filter.push({ term: { category } });
    }
    if (status) {
      esQuery.body.query.bool.filter.push({ term: { status } });
    }
    if (minGoal !== undefined || maxGoal !== undefined) {
      const range: any = {};
      if (minGoal !== undefined) range.gte = minGoal;
      if (maxGoal !== undefined) range.lte = maxGoal;
      esQuery.body.query.bool.filter.push({ range: { goal: range } });
    }

    // If no query provided, match all with filters
    if (esQuery.body.query.bool.must.length === 0) {
      esQuery.body.query.bool.must.push({ match_all: {} });
    }

    const response = await fetch(`${this.elasticsearchUrl}/${this.indexName}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(esQuery.body),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
      score: hit._score,
    }));
  }

  /**
   * PostgreSQL fallback search using LIKE queries
   */
  private async searchWithPostgreSQL(options: SearchOptions): Promise<SearchResult[]> {
    const { query, limit = 20, offset = 0, category, status, minGoal, maxGoal } = options;

    const where: any = {};

    // Text search with LIKE
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Filters
    if (category) where.category = category;
    if (status) where.status = status;
    if (minGoal !== undefined || maxGoal !== undefined) {
      where.goal = {};
      if (minGoal !== undefined) where.goal.gte = BigInt(minGoal);
      if (maxGoal !== undefined) where.goal.lte = BigInt(maxGoal);
    }

    const projects = await this.prisma.project.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        goal: true,
        currentFunds: true,
        creatorId: true,
      },
    });

    return projects.map((p) => ({
      ...p,
      goal: Number(p.goal),
      currentFunds: Number(p.currentFunds),
      score: 0, // No relevance score in PostgreSQL fallback
    }));
  }

  /**
   * Sync a single project to Elasticsearch
   */
  async syncProject(projectId: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        this.logger.warn(`Project ${projectId} not found for sync`);
        return;
      }

      await this.indexProject(project);
      this.logger.debug(`Synced project ${projectId} to Elasticsearch`);
    } catch (error) {
      this.logger.error(`Failed to sync project ${projectId}: ${error.message}`);
    }
  }

  /**
   * Sync all projects to Elasticsearch
   */
  async syncProjectsToElasticsearch(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      this.logger.log('Starting full project sync to Elasticsearch...');
      
      const projects = await this.prisma.project.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          goal: true,
          currentFunds: true,
          creatorId: true,
          createdAt: true,
        },
      });

      // Bulk index documents
      const bulkOperations: any[] = [];
      for (const project of projects) {
        bulkOperations.push(
          { index: { _index: this.indexName, _id: project.id } },
          {
            ...project,
            goal: Number(project.goal),
            currentFunds: Number(project.currentFunds),
          },
        );
      }

      if (bulkOperations.length > 0) {
        const response = await fetch(`${this.elasticsearchUrl}/_bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkOperations.join('\n') + '\n'),
        });

        if (!response.ok) {
          throw new Error(`Bulk index failed: ${response.statusText}`);
        }

        this.logger.log(`Synced ${projects.length} projects to Elasticsearch`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync projects: ${error.message}`);
    }
  }

  /**
   * Remove a project from Elasticsearch index
   */
  async removeProject(projectId: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${this.elasticsearchUrl}/${this.indexName}/_doc/${projectId}`, {
        method: 'DELETE',
      });
      this.logger.debug(`Removed project ${projectId} from Elasticsearch`);
    } catch (error) {
      this.logger.error(`Failed to remove project ${projectId}: ${error.message}`);
    }
  }

  /**
   * Initialize Elasticsearch index with proper mappings
   */
  private async initializeIndex(): Promise<void> {
    try {
      // Check if index exists
      const checkResponse = await fetch(`${this.elasticsearchUrl}/${this.indexName}`, {
        method: 'HEAD',
      });

      if (checkResponse.ok) {
        this.logger.log(`Elasticsearch index '${this.indexName}' already exists`);
        return;
      }

      // Create index with mappings
      const createResponse = await fetch(`${this.elasticsearchUrl}/${this.indexName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: {
                type: 'text',
                analyzer: 'standard',
              },
              category: { type: 'keyword' },
              status: { type: 'keyword' },
              goal: { type: 'long' },
              currentFunds: { type: 'long' },
              creatorId: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create index: ${createResponse.statusText}`);
      }

      this.logger.log(`Created Elasticsearch index '${this.indexName}'`);
    } catch (error) {
      this.logger.error(`Failed to initialize Elasticsearch index: ${error.message}`);
    }
  }

  /**
   * Index a single project
   */
  private async indexProject(project: any): Promise<void> {
    await fetch(`${this.elasticsearchUrl}/${this.indexName}/_doc/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: project.id,
        title: project.title,
        description: project.description || '',
        category: project.category,
        status: project.status,
        goal: Number(project.goal),
        currentFunds: Number(project.currentFunds),
        creatorId: project.creatorId,
        createdAt: project.createdAt,
      }),
    });
  }

  /**
   * Get search suggestions for auto-completion
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    if (!this.isEnabled) {
      // Fallback: simple PostgreSQL query
      const projects = await this.prisma.project.findMany({
        where: {
          title: { startsWith: prefix, mode: 'insensitive' },
        },
        take: limit,
        select: { title: true },
      });
      return projects.map((p) => p.title);
    }

    try {
      const response = await fetch(`${this.elasticsearchUrl}/${this.indexName}/_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggest: {
            title_suggest: {
              prefix,
              completion: {
                field: 'title',
                size: limit,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Suggestions request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.suggest.title_suggest[0]?.options?.map((opt: any) => opt._source.title) || [];
    } catch (error) {
      this.logger.error(`Failed to get suggestions: ${error.message}`);
      return [];
    }
  }
}
