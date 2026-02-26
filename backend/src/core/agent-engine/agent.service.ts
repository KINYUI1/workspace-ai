import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import type { ApiResponse, Agent, CreateAgentDto, UpdateAgentDto } from '../../../../shared/types';

export class AgentService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async create(userId: string, dto: CreateAgentDto): Promise<Agent> {
    // Enforce one main agent per user
    if (dto.isMainAgent) {
      const existing = await this.db.agent.findFirst({
        where: { userId, isMainAgent: true },
      });
      if (existing) {
        throw new ConflictError('User already has a main agent');
      }
    }

    // Enforce max agents per user
    const agentCount = await this.db.agent.count({ where: { userId } });
    const maxAgents = Number(process.env.MAX_AGENTS_PER_USER) || 100;
    if (agentCount >= maxAgents) {
      throw new ValidationError(`Maximum of ${maxAgents} agents per user reached`);
    }

    const agent = await this.db.agent.create({
      data: {
        userId,
        name: dto.name,
        role: dto.role,
        specialty: dto.specialty,
        teamId: dto.teamId ?? null,
        capabilities: dto.capabilities ?? [],
        isMainAgent: dto.isMainAgent ?? false,
        personality: dto.personality ?? null,
        modelProvider: dto.modelProvider ?? 'anthropic',
        modelName: dto.modelName ?? null,
        status: 'idle',
      },
    });

    // Auto-create agent context
    await this.db.agentContext.create({
      data: { agentId: agent.id },
    });

    logger.info('Agent created', { agentId: agent.id, name: agent.name, userId });
    return this.toDto(agent);
  }

  async findById(userId: string, agentId: string): Promise<Agent> {
    const agent = await this.db.agent.findFirst({
      where: { id: agentId, userId },
      include: { team: { select: { id: true, name: true } } },
    });

    if (!agent) {
      throw new NotFoundError('Agent', agentId);
    }

    return this.toDto(agent);
  }

  async findAll(userId: string, pagination: PaginationParams) {
    const [agents, total] = await Promise.all([
      this.db.agent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { team: { select: { id: true, name: true } } },
        ...getPaginationOffset(pagination),
      }),
      this.db.agent.count({ where: { userId } }),
    ]);

    return {
      data: agents.map((a) => this.toDto(a)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async findByTeam(userId: string, teamId: string): Promise<Agent[]> {
    const agents = await this.db.agent.findMany({
      where: { userId, teamId },
      orderBy: { createdAt: 'asc' },
    });

    return agents.map((a) => this.toDto(a));
  }

  async getMainAgent(userId: string): Promise<Agent | null> {
    const agent = await this.db.agent.findFirst({
      where: { userId, isMainAgent: true },
      include: { team: { select: { id: true, name: true } } },
    });

    return agent ? this.toDto(agent) : null;
  }

  async update(userId: string, agentId: string, dto: UpdateAgentDto): Promise<Agent> {
    // Verify ownership
    await this.findById(userId, agentId);

    const agent = await this.db.agent.update({
      where: { id: agentId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.specialty !== undefined && { specialty: dto.specialty }),
        ...(dto.teamId !== undefined && { teamId: dto.teamId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.capabilities !== undefined && { capabilities: dto.capabilities }),
        ...(dto.personality !== undefined && { personality: dto.personality }),
        ...(dto.modelProvider !== undefined && { modelProvider: dto.modelProvider }),
        ...(dto.modelName !== undefined && { modelName: dto.modelName }),
        lastActive: new Date(),
      },
    });

    logger.info('Agent updated', { agentId, userId });
    return this.toDto(agent);
  }

  async delete(userId: string, agentId: string): Promise<void> {
    const agent = await this.findById(userId, agentId);

    if (agent.isMainAgent) {
      throw new ValidationError('Cannot delete the main agent');
    }

    await this.db.agent.delete({ where: { id: agentId } });
    logger.info('Agent deleted', { agentId, userId });
  }

  async updateStatus(agentId: string, status: string): Promise<void> {
    await this.db.agent.update({
      where: { id: agentId },
      data: { status, lastActive: new Date() },
    });
  }

  async getActiveAgents(userId: string): Promise<Agent[]> {
    const agents = await this.db.agent.findMany({
      where: {
        userId,
        status: { in: ['active', 'busy'] },
      },
    });

    return agents.map((a) => this.toDto(a));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(agent: any): Agent & { teamName?: string } {
    return {
      id: agent.id,
      userId: agent.userId,
      teamId: agent.teamId,
      name: agent.name,
      role: agent.role,
      specialty: agent.specialty,
      status: agent.status,
      isMainAgent: agent.isMainAgent,
      contextId: agent.contextId,
      currentTaskId: agent.currentTaskId,
      capabilities: agent.capabilities,
      personality: agent.personality ?? null,
      modelProvider: agent.modelProvider ?? 'anthropic',
      modelName: agent.modelName ?? null,
      createdAt: agent.createdAt,
      lastActive: agent.lastActive,
      lastSyncAt: agent.lastSyncAt,
      stats: agent.stats as Agent['stats'],
      ...(agent.team ? { teamName: agent.team.name } : {}),
    };
  }
}
