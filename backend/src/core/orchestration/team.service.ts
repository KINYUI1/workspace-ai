import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import type { Team, CreateTeamDto, UpdateTeamDto } from '../../../../shared/types';

export class TeamService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async create(userId: string, dto: CreateTeamDto): Promise<Team> {
    const team = await this.db.team.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        goal: dto.goal,
        leadAgentId: dto.leadAgentId ?? null,
      },
    });

    logger.info('Team created', { teamId: team.id, name: team.name, userId });
    return this.toDto(team);
  }

  async findById(userId: string, teamId: string): Promise<Team> {
    const team = await this.db.team.findFirst({
      where: { id: teamId, userId },
    });

    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    return this.toDto(team);
  }

  async findAll(userId: string, pagination: PaginationParams) {
    const [teams, total] = await Promise.all([
      this.db.team.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { agents: true } } },
        ...getPaginationOffset(pagination),
      }),
      this.db.team.count({ where: { userId } }),
    ]);

    return {
      data: teams.map((t) => ({
        ...this.toDto(t),
        agentCount: t._count.agents,
      })),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async update(userId: string, teamId: string, dto: UpdateTeamDto): Promise<Team> {
    await this.findById(userId, teamId);

    const team = await this.db.team.update({
      where: { id: teamId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.goal !== undefined && { goal: dto.goal }),
        ...(dto.leadAgentId !== undefined && { leadAgentId: dto.leadAgentId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.sharedContext !== undefined && { sharedContext: dto.sharedContext }),
      },
    });

    logger.info('Team updated', { teamId, userId });
    return this.toDto(team);
  }

  async delete(userId: string, teamId: string): Promise<void> {
    await this.findById(userId, teamId);

    // Unassign agents from team before deleting
    await this.db.agent.updateMany({
      where: { teamId },
      data: { teamId: null },
    });

    await this.db.team.delete({ where: { id: teamId } });
    logger.info('Team deleted', { teamId, userId });
  }

  async addAgent(userId: string, teamId: string, agentId: string): Promise<void> {
    await this.findById(userId, teamId);

    await this.db.agent.update({
      where: { id: agentId },
      data: { teamId },
    });

    logger.info('Agent added to team', { teamId, agentId });
  }

  async removeAgent(userId: string, teamId: string, agentId: string): Promise<void> {
    await this.findById(userId, teamId);

    await this.db.agent.update({
      where: { id: agentId },
      data: { teamId: null },
    });

    logger.info('Agent removed from team', { teamId, agentId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(team: any): Team {
    return {
      id: team.id,
      userId: team.userId,
      name: team.name,
      description: team.description ?? '',
      goal: team.goal ?? '',
      leadAgentId: team.leadAgentId,
      sharedContext: team.sharedContext ?? '',
      status: team.status,
      createdAt: team.createdAt,
    };
  }
}
