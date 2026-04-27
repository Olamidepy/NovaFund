import { Resolver, Query, Args, Parent, ResolveField, Context } from '@nestjs/graphql';
import { Project } from './dto/project.dto';
import { DataLoaderContext } from '../graphql/dataloaders/dataloader.factory';

/**
 * Example resolver demonstrating DataLoader usage to eliminate N+1 queries
 * 
 * USAGE IN GRAPHQL QUERIES:
 * 
 * // This query would normally cause N+1 issues:
 * query {
 *   projects {
 *     projects {
 *       id
 *       title
 *       creator {        // Without DataLoader: N queries
 *         id
 *         email
 *       }
 *       contributions {  // Without DataLoader: N queries
 *         id
 *         amount
 *       }
 *       milestones {     // Without DataLoader: N queries
 *         id
 *         title
 *       }
 *     }
 *   }
 * }
 * 
 * WITH DataLoader: Only 3-4 queries total regardless of project count!
 */
@Resolver(() => Project)
export class ProjectRelationsResolver {
  /**
   * Resolve project.creator using DataLoader
   * Batches all creator requests into a single query
   */
  @ResolveField(() => Object, { nullable: true, name: 'creator' })
  async creator(
    @Parent() project: Project,
    @Context() context: DataLoaderContext,
  ) {
    // DataLoader automatically batches this with other creator requests
    return context.userLoader.load(project.creatorId);
  }

  /**
   * Resolve project.contributions using DataLoader
   * Batches all contribution requests into a single query
   */
  @ResolveField(() => [Object], { nullable: true, name: 'contributions' })
  async contributions(
    @Parent() project: Project,
    @Context() context: DataLoaderContext,
  ) {
    // DataLoader automatically batches this with other contribution requests
    return context.contributionsByProjectLoader.load(project.id);
  }

  /**
   * Resolve project.milestones using DataLoader
   * Batches all milestone requests into a single query
   */
  @ResolveField(() => [Object], { nullable: true, name: 'milestones' })
  async milestones(
    @Parent() project: Project,
    @Context() context: DataLoaderContext,
  ) {
    // DataLoader automatically batches this with other milestone requests
    return context.milestonesByProjectLoader.load(project.id);
  }

  /**
   * Example: Get a single project with all relations
   * This will use DataLoaders for all nested relations
   */
  @Query(() => Project, { name: 'projectWithRelations' })
  async projectWithRelations(
    @Args('id') id: string,
    @Context() context: DataLoaderContext,
  ) {
    // The relations will be resolved by the field resolvers above
    // which use DataLoaders automatically
    return { id };
  }
}
