import DataLoader from 'dataloader';
import { PrismaService } from '../../prisma.service';
import { Injectable, Scope } from '@nestjs/common';

export interface DataLoaderContext {
  userLoader: DataLoader<string, any>;
  projectLoader: DataLoader<string, any>;
  contributionsByProjectLoader: DataLoader<string, any[]>;
  contributionsByUserLoader: DataLoader<string, any[]>;
  milestonesByProjectLoader: DataLoader<string, any[]>;
}

@Injectable({ scope: Scope.REQUEST })
export class DataLoaderFactory {
  constructor(private readonly prisma: PrismaService) {}

  createContext(): DataLoaderContext {
    return {
      userLoader: this.createUserLoader(),
      projectLoader: this.createProjectLoader(),
      contributionsByProjectLoader: this.createContributionsByProjectLoader(),
      contributionsByUserLoader: this.createContributionsByUserLoader(),
      milestonesByProjectLoader: this.createMilestonesByProjectLoader(),
    };
  }

  /**
   * DataLoader for batching user fetches
   * Solves N+1 when querying project.creator
   */
  private createUserLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(async (userIds: ReadonlyArray<string>) => {
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: Array.from(userIds),
          },
        },
      });

      const userMap = new Map(users.map((user) => [user.id, user]));
      return userIds.map((id) => userMap.get(id) || null);
    });
  }

  /**
   * DataLoader for batching project fetches
   * Solves N+1 when querying contribution.project
   */
  private createProjectLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(async (projectIds: ReadonlyArray<string>) => {
      const projects = await this.prisma.project.findMany({
        where: {
          id: {
            in: Array.from(projectIds),
          },
        },
      });

      const projectMap = new Map(projects.map((project) => [project.id, project]));
      return projectIds.map((id) => projectMap.get(id) || null);
    });
  }

  /**
   * DataLoader for batching contributions by project
   * Solves N+1 when querying project.contributions
   */
  private createContributionsByProjectLoader(): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(async (projectIds: ReadonlyArray<string>) => {
      const contributions = await this.prisma.contribution.findMany({
        where: {
          projectId: {
            in: Array.from(projectIds),
          },
        },
      });

      const contributionsMap = new Map<string, any[]>();
      for (const projectId of projectIds) {
        contributionsMap.set(projectId, []);
      }

      contributions.forEach((contribution) => {
        const list = contributionsMap.get(contribution.projectId);
        if (list) {
          list.push(contribution);
        }
      });

      return Array.from(projectIds).map((id) => contributionsMap.get(id) || []);
    });
  }

  /**
   * DataLoader for batching contributions by user
   * Solves N+1 when querying user.contributions
   */
  private createContributionsByUserLoader(): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(async (userIds: ReadonlyArray<string>) => {
      const contributions = await this.prisma.contribution.findMany({
        where: {
          investorId: {
            in: Array.from(userIds),
          },
        },
      });

      const contributionsMap = new Map<string, any[]>();
      for (const userId of userIds) {
        contributionsMap.set(userId, []);
      }

      contributions.forEach((contribution) => {
        const list = contributionsMap.get(contribution.investorId);
        if (list) {
          list.push(contribution);
        }
      });

      return Array.from(userIds).map((id) => contributionsMap.get(id) || []);
    });
  }

  /**
   * DataLoader for batching milestones by project
   * Solves N+1 when querying project.milestones
   */
  private createMilestonesByProjectLoader(): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(async (projectIds: ReadonlyArray<string>) => {
      const milestones = await this.prisma.milestone.findMany({
        where: {
          projectId: {
            in: Array.from(projectIds),
          },
        },
      });

      const milestonesMap = new Map<string, any[]>();
      for (const projectId of projectIds) {
        milestonesMap.set(projectId, []);
      }

      milestones.forEach((milestone) => {
        const list = milestonesMap.get(milestone.projectId);
        if (list) {
          list.push(milestone);
        }
      });

      return Array.from(projectIds).map((id) => milestonesMap.get(id) || []);
    });
  }
}
