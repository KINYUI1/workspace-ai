import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { AgentRuntime } from '../agent-engine/agent-runtime';
import { TaskDispatcher } from '../orchestration/task-dispatcher';
import { logger } from '../../utils/logger';
import { emitGlobal } from './websocket';
import type { Agent, BroadcastMessage, SyncResponse } from '../../../../shared/types';

/**
 * SyncScheduler manages the 20-minute broadcast cycle
 * where the main agent syncs state to all active agents.
 */
export class SyncScheduler extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly db: PrismaClient;
  private readonly apiKey: string;
  private readonly intervalMs: number;

  constructor(apiKey: string, intervalMinutes = 20) {
    super();
    this.db = getPrismaClient();
    this.apiKey = apiKey;
    this.intervalMs = intervalMinutes * 60 * 1000;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('SyncScheduler already running');
      return;
    }

    logger.info('SyncScheduler starting', {
      intervalMinutes: this.intervalMs / 60_000,
    });

    this.isRunning = true;

    // Run first sync after a short delay to allow server startup
    setTimeout(() => this.performSync(), 5_000);

    // Schedule recurring syncs
    this.timer = setInterval(() => this.performSync(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('SyncScheduler stopped');
  }

  /**
   * Trigger an immediate sync cycle (outside the regular schedule).
   */
  async triggerSync(): Promise<void> {
    await this.performSync();
  }

  private async performSync(): Promise<void> {
    const syncId = Date.now();
    logger.info('Sync cycle starting', { syncId });

    try {
      emitGlobal('sync:start', { timestamp: new Date() });

      // Get all users who have active agents
      const users = await this.db.user.findMany({
        where: { agents: { some: { status: { in: ['active', 'busy'] } } } },
        select: { id: true },
      });

      for (const user of users) {
        await this.syncUserAgents(user.id, syncId);
      }

      emitGlobal('sync:complete', { timestamp: new Date() });
    } catch (error) {
      logger.error('Sync cycle failed', { syncId, error: (error as Error).message });
      this.emit('sync:error', error);
    }
  }

  private async syncUserAgents(userId: string, syncId: number): Promise<void> {
    // Find the main agent for this user
    const mainAgentRecord = await this.db.agent.findFirst({
      where: { userId, isMainAgent: true },
    });

    if (!mainAgentRecord) return;

    // Get all active non-main agents
    const activeAgents = await this.db.agent.findMany({
      where: {
        userId,
        isMainAgent: false,
        status: { in: ['active', 'busy', 'idle'] },
      },
    });

    if (activeAgents.length === 0) return;

    // Prepare broadcast
    const pendingTasks = await this.db.task.findMany({
      where: { userId, status: 'pending' },
      take: 10,
    });

    const broadcast: BroadcastMessage = {
      type: 'sync',
      from: mainAgentRecord.id,
      timestamp: new Date(),
      data: {
        globalContext: `System sync at ${new Date().toISOString()}. Active agents: ${activeAgents.length}. Pending tasks: ${pendingTasks.length}.`,
        newTasks: pendingTasks.map((t) => ({
          id: t.id,
          userId: t.userId,
          teamId: t.teamId,
          title: t.title,
          description: t.description ?? '',
          priority: t.priority as 'low' | 'medium' | 'high' | 'critical',
          status: t.status as 'pending',
          createdByAgentId: t.createdByAgentId,
          createdAt: t.createdAt,
          deadline: t.deadline,
          progress: t.progress,
          result: null,
          metadata: (t.metadata as Record<string, unknown>) ?? {},
        })),
      },
    };

    // Send to all agents in parallel
    const results = await Promise.allSettled(
      activeAgents.map((agentRecord) =>
        this.syncAgent(agentRecord as unknown as Agent, broadcast),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('User agent sync complete', {
      syncId,
      userId,
      succeeded,
      failed,
      total: activeAgents.length,
    });

    this.emit('sync:user_complete', { userId, succeeded, failed });
  }

  private async syncAgent(
    agent: Agent,
    broadcast: BroadcastMessage,
  ): Promise<SyncResponse> {
    try {
      const runtime = new AgentRuntime(agent, this.apiKey);
      const response = await runtime.receiveBroadcast(broadcast);

      // Auto-dispatch any pending tasks assigned to this agent
      await this.dispatchPendingTasks(agent);

      return response;
    } catch (error) {
      logger.error('Failed to sync agent', {
        agentId: agent.id,
        error: (error as Error).message,
      });

      return {
        agentId: agent.id,
        status: 'failed',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Find pending tasks assigned to this agent and dispatch them for execution.
   */
  private async dispatchPendingTasks(agent: Agent): Promise<void> {
    try {
      const pendingAssignments = await this.db.taskAssignment.findMany({
        where: {
          agentId: agent.id,
          task: { status: 'pending' },
        },
        include: { task: { select: { id: true, userId: true } } },
        take: 3,
      });

      if (pendingAssignments.length === 0) return;

      logger.info('SyncScheduler: auto-dispatching pending tasks', {
        agentId: agent.id,
        agentName: agent.name,
        taskCount: pendingAssignments.length,
      });

      const dispatcher = new TaskDispatcher();
      for (const assignment of pendingAssignments) {
        dispatcher.dispatch(assignment.task.id, assignment.task.userId).catch((err) => {
          logger.error('SyncScheduler: auto-dispatch failed', {
            taskId: assignment.task.id,
            error: (err as Error).message,
          });
        });
      }
    } catch (error) {
      logger.error('SyncScheduler: dispatchPendingTasks failed', {
        agentId: agent.id,
        error: (error as Error).message,
      });
    }
  }
}
