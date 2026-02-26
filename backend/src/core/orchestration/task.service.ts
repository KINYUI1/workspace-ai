import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import type { Task, CreateTaskDto, UpdateTaskDto } from '../../../../shared/types';

export class TaskService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async create(userId: string, dto: CreateTaskDto, createdByAgentId?: string): Promise<Task> {
    const task = await this.db.task.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        teamId: dto.teamId ?? null,
        priority: dto.priority ?? 'medium',
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        createdByAgentId: createdByAgentId ?? null,
      },
    });

    // Create assignments if agents specified
    if (dto.assignTo && dto.assignTo.length > 0) {
      await this.db.taskAssignment.createMany({
        data: dto.assignTo.map((agentId) => ({
          taskId: task.id,
          agentId,
        })),
      });
    }

    logger.info('Task created', { taskId: task.id, title: task.title, userId });
    return this.toDto(task);
  }

  async findById(userId: string, taskId: string): Promise<Task & { assignedTo: string[] }> {
    const task = await this.db.task.findFirst({
      where: { id: taskId, userId },
      include: {
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignments: {
          select: {
            agentId: true,
            agent: { select: { id: true, name: true, role: true, status: true } },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    return {
      ...this.toDto(task),
      assignedTo: task.assignments.map((a) => a.agentId),
    };
  }

  async findAll(userId: string, pagination: PaginationParams, filters?: { status?: string; teamId?: string; priority?: string }) {
    const where = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.teamId && { teamId: filters.teamId }),
      ...(filters?.priority && { priority: filters.priority }),
    };

    const [tasks, total] = await Promise.all([
      this.db.task.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          team: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          assignments: {
            select: {
              agentId: true,
              agent: { select: { id: true, name: true, role: true, status: true } },
            },
            orderBy: { assignedAt: 'asc' },
          },
        },
        ...getPaginationOffset(pagination),
      }),
      this.db.task.count({ where }),
    ]);

    return {
      data: tasks.map((t) => ({
        ...this.toDto(t),
        assignedTo: t.assignments.map((a) => a.agentId),
      })),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {
    await this.findById(userId, taskId);

    const task = await this.db.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.progress !== undefined && { progress: dto.progress }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline ? new Date(dto.deadline) : null,
        }),
        ...(dto.result !== undefined && { result: dto.result as Prisma.InputJsonValue }),
      },
    });

    logger.info('Task updated', { taskId, status: dto.status, progress: dto.progress });
    return this.toDto(task);
  }

  async delete(userId: string, taskId: string): Promise<void> {
    await this.findById(userId, taskId);
    await this.db.task.delete({ where: { id: taskId } });
    logger.info('Task deleted', { taskId, userId });
  }

  async assignAgent(userId: string, taskId: string, agentId: string): Promise<void> {
    await this.findById(userId, taskId);

    await this.db.taskAssignment.create({
      data: { taskId, agentId },
    });

    logger.info('Agent assigned to task', { taskId, agentId });
  }

  async unassignAgent(userId: string, taskId: string, agentId: string): Promise<void> {
    await this.findById(userId, taskId);

    await this.db.taskAssignment.delete({
      where: { taskId_agentId: { taskId, agentId } },
    });

    logger.info('Agent unassigned from task', { taskId, agentId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(task: any): Task {
    return {
      id: task.id,
      userId: task.userId,
      teamId: task.teamId,
      teamName: task.team?.name ?? undefined,
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      status: task.status,
      createdByAgentId: task.createdByAgentId,
      createdByAgentName: task.createdBy?.name ?? undefined,
      assignedAgents: task.assignments?.map((a: { agent: { id: string; name: string; role: string; status: string } }) => ({
        id: a.agent.id,
        name: a.agent.name,
        role: a.agent.role,
        status: a.agent.status,
      })) ?? undefined,
      createdAt: task.createdAt,
      deadline: task.deadline,
      progress: task.progress,
      result: task.result,
      metadata: task.metadata ?? {},
    };
  }
}
