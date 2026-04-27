import { Controller, Get, Param, Query, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { Scopes } from '../decorators/scopes.decorator';
import { ProjectService } from './project.service';
import { Project } from './dto/project.dto';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get(':id')
  async getProject(
    @Param('id') id: string,
    @Query('fields') fields?: string,
  ): Promise<Partial<Project>> {
    const requiredFields = fields ? fields.split(',') : undefined;
    return this.projectService.findById(id, requiredFields);
  }

  @Get('contract/:contractId')
  async getProjectByContractId(
    @Param('contractId') contractId: string,
    @Query('fields') fields?: string,
  ): Promise<Partial<Project>> {
    const requiredFields = fields ? fields.split(',') : undefined;
    return this.projectService.findByContractId(contractId, requiredFields);
  }

  @Get()
  async getProjects(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('fields') fields?: string,
  ) {
    const requiredFields = fields ? fields.split(',') : undefined;
    return this.projectService.findAll({ 
      skip: skip ? parseInt(skip.toString()) : undefined,
      take: take ? parseInt(take.toString()) : undefined,
      status,
      category,
    }, requiredFields);
  }

  @Get('active/list')
  async getActiveProjects(
    @Query('limit') limit?: number,
    @Query('fields') fields?: string,
  ) {
    const requiredFields = fields ? fields.split(',') : undefined;
    return this.projectService.findActiveProjects(
      limit ? parseInt(limit.toString()) : undefined,
      requiredFields,
    );
  }

  @Get('creator/:creatorId')
  async getProjectsByCreator(
    @Param('creatorId') creatorId: string,
    @Query('limit') limit?: number,
    @Query('fields') fields?: string,
  ) {
    const requiredFields = fields ? fields.split(',') : undefined;
    return this.projectService.findByCreator(
      creatorId,
      limit ? parseInt(limit.toString()) : undefined,
      requiredFields,
    );
  }

  @Patch(':id')
  @UseGuards(ApiKeyGuard)
  @Scopes('project:edit')
  async updateProject(@Param('id') id: string, @Body() data: any) {
    // In a real implementation, this would call projectService.update
    return { success: true, id, message: 'Project updated successfully (scope validated)' };
  }
}
