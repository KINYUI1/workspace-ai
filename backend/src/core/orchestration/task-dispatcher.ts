import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AgentRuntime } from '../agent-engine/agent-runtime';
import { emitToUser } from '../communication/websocket';
import type { Agent, AgentStats } from '../../../../shared/types';

/**
 * TaskDispatcher runs assigned agents against a task autonomously.
 *
 * Flow:
 *  1. Load the task and its assigned agents (ordered by assignment time).
 *  2. For each agent, create an AgentRuntime and call executeTask().
 *     Each agent receives the accumulated outputs of agents that ran before it,
 *     simulating team collaboration where each member builds on prior work.
 *  3. Update task progress after each agent finishes.
 *  4. When all agents are done, mark the task as completed and
 *     notify Atlas + the user with the compiled results.
 */
export class TaskDispatcher {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  /**
   * Dispatch a task for execution by its assigned agents.
   * This runs asynchronously — call it without `await` for fire-and-forget.
   */
  async dispatch(taskId: string, userId: string): Promise<void> {
    try {
      // 1. Load the task
      const task = await this.db.task.findFirst({
        where: { id: taskId, userId },
        include: {
          assignments: {
            include: { agent: true },
            orderBy: { assignedAt: 'asc' },
          },
        },
      });

      if (!task) {
        logger.warn('TaskDispatcher: task not found', { taskId });
        return;
      }

      const assignedAgents = task.assignments.map((a) => a.agent);

      if (assignedAgents.length === 0) {
        logger.info('TaskDispatcher: no agents assigned, skipping', { taskId });
        return;
      }

      logger.info('TaskDispatcher: starting execution', {
        taskId,
        taskTitle: task.title,
        agentCount: assignedAgents.length,
        agents: assignedAgents.map((a) => a.name),
      });

      // 2. Mark task as in_progress
      await this.db.task.update({
        where: { id: taskId },
        data: { status: 'in_progress', progress: 0 },
      });

      emitToUser(userId, 'task:update', {
        taskId,
        status: 'in_progress',
        progress: 0,
      });

      // 3. Load team info if this is a team task
      let teamContext = '';
      if (task.teamId) {
        const team = await this.db.team.findUnique({
          where: { id: task.teamId },
          include: { agents: { select: { id: true, name: true, role: true, specialty: true } } },
        });
        if (team) {
          teamContext = `\nTeam: ${team.name}\nGoal: ${team.goal}\nTeam Members: ${team.agents.map((a) => `${a.name} (${a.role}, specialties: ${a.specialty.join(', ')})`).join('; ')}`;
        }
      }

      // 4. Run each agent sequentially, accumulating outputs
      const agentOutputs: { agentName: string; role: string; output: string }[] = [];
      const totalAgents = assignedAgents.length;

      for (let i = 0; i < totalAgents; i++) {
        const agentRecord = assignedAgents[i];

        // Notify user that this agent started working
        emitToUser(userId, 'agent:status', {
          agentId: agentRecord.id,
          status: 'busy',
        });

        emitToUser(userId, 'agent:message', {
          id: `dispatch-${taskId}-${agentRecord.id}-start`,
          agentId: agentRecord.id,
          agentName: agentRecord.name,
          content: `Working on task: **${task.title}**`,
          timestamp: new Date().toISOString(),
        });

        try {
          const agentDto = this.toAgentDto(agentRecord);

          const runtime = new AgentRuntime(agentDto, env.ANTHROPIC_API_KEY);

          // Build a collaborative task that includes prior agent outputs
          const collaborativeTask = this.buildCollaborativeTask(
            {
              id: task.id,
              userId: task.userId,
              teamId: task.teamId,
              title: task.title,
              description: task.description ?? '',
              priority: task.priority as 'low' | 'medium' | 'high' | 'critical',
              status: task.status as 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked',
              createdByAgentId: task.createdByAgentId,
              createdAt: task.createdAt,
              deadline: task.deadline,
              progress: task.progress,
              result: task.result as Record<string, unknown> | null,
              metadata: (task.metadata ?? {}) as Record<string, unknown>,
            },
            teamContext,
            agentOutputs,
          );

          const result = await runtime.executeTask(collaborativeTask);
          const output = typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output);

          agentOutputs.push({
            agentName: agentRecord.name,
            role: agentRecord.role,
            output,
          });

          // Update progress
          const progress = Math.round(((i + 1) / totalAgents) * 100);
          await this.db.task.update({
            where: { id: taskId },
            data: { progress },
          });

          emitToUser(userId, 'task:update', {
            taskId,
            status: 'in_progress',
            progress,
          });

          // Notify user that this agent finished
          emitToUser(userId, 'agent:status', {
            agentId: agentRecord.id,
            status: 'idle',
          });

          emitToUser(userId, 'agent:message', {
            id: `dispatch-${taskId}-${agentRecord.id}-done`,
            agentId: agentRecord.id,
            agentName: agentRecord.name,
            content: output,
            timestamp: new Date().toISOString(),
          });

          logger.info('TaskDispatcher: agent completed', {
            taskId,
            agentName: agentRecord.name,
            outputLength: output.length,
          });
        } catch (error) {
          logger.error('TaskDispatcher: agent failed', {
            taskId,
            agentName: agentRecord.name,
            error: (error as Error).message,
          });

          emitToUser(userId, 'agent:status', {
            agentId: agentRecord.id,
            status: 'error',
          });

          agentOutputs.push({
            agentName: agentRecord.name,
            role: agentRecord.role,
            output: `[Error: ${(error as Error).message}]`,
          });
        }
      }

      // 5. Mark task as completed with compiled results
      const compiledResult = {
        completedAt: new Date().toISOString(),
        agentContributions: agentOutputs,
      };

      await this.db.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          progress: 100,
          result: compiledResult as unknown as Prisma.InputJsonValue,
        },
      });

      emitToUser(userId, 'task:update', {
        taskId,
        status: 'completed',
        progress: 100,
      });

      // 6. Notify Atlas (the user's main agent) with the compiled results
      await this.notifyAtlas(userId, task.title, agentOutputs);

      logger.info('TaskDispatcher: task completed', {
        taskId,
        taskTitle: task.title,
        agentCount: totalAgents,
      });
    } catch (error) {
      logger.error('TaskDispatcher: dispatch failed', {
        taskId,
        error: (error as Error).message,
      });

      // Mark task as failed
      await this.db.task.update({
        where: { id: taskId },
        data: { status: 'failed' },
      }).catch(() => {});

      emitToUser(userId, 'task:update', {
        taskId,
        status: 'failed',
        progress: 0,
      });
    }
  }

  /**
   * Build a task object enriched with team context and prior agent outputs
   * so each agent can build on the work of those before it.
   */
  private buildCollaborativeTask(
    task: {
      id: string;
      userId: string;
      teamId: string | null;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
      createdByAgentId: string | null;
      createdAt: Date;
      deadline: Date | null;
      progress: number;
      result: Record<string, unknown> | null;
      metadata: Record<string, unknown>;
    },
    teamContext: string,
    priorOutputs: { agentName: string; role: string; output: string }[],
  ) {
    let enrichedDescription = task.description;

    if (teamContext) {
      enrichedDescription += `\n\n--- Team Context ---${teamContext}`;
    }

    if (priorOutputs.length > 0) {
      enrichedDescription += '\n\n--- Prior Team Member Contributions ---\n';
      enrichedDescription += 'Build on the work below. Do NOT repeat it — extend, refine, or add your unique expertise.\n\n';
      for (const prior of priorOutputs) {
        enrichedDescription += `**${prior.agentName}** (${prior.role}):\n${prior.output}\n\n`;
      }
    }

    return { ...task, description: enrichedDescription };
  }

  /**
   * Send the compiled task results back to Atlas so it can report to the user.
   */
  private async notifyAtlas(
    userId: string,
    taskTitle: string,
    agentOutputs: { agentName: string; role: string; output: string }[],
  ): Promise<void> {
    // Find the user's main agent
    const mainAgent = await this.db.agent.findFirst({
      where: { userId, isMainAgent: true },
    });

    if (!mainAgent) return;

    // Compile a summary for Atlas to relay to the user
    const summary = agentOutputs
      .map((o) => `**${o.agentName}** (${o.role}):\n${o.output}`)
      .join('\n\n---\n\n');

    const atlasMessage = `Task "${taskTitle}" has been completed by the team.\n\nHere are the results:\n\n${summary}`;

    // Send as a chat message from Atlas to the user
    emitToUser(userId, 'agent:message', {
      id: `atlas-report-${Date.now()}`,
      agentId: mainAgent.id,
      agentName: mainAgent.name,
      content: atlasMessage,
      timestamp: new Date().toISOString(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toAgentDto(record: any): Agent {
    return {
      id: record.id,
      userId: record.userId,
      teamId: record.teamId,
      name: record.name,
      role: record.role,
      specialty: record.specialty,
      status: record.status,
      isMainAgent: record.isMainAgent,
      contextId: record.contextId,
      currentTaskId: record.currentTaskId,
      capabilities: record.capabilities,
      createdAt: record.createdAt,
      lastActive: record.lastActive,
      lastSyncAt: record.lastSyncAt,
      stats: record.stats as unknown as AgentStats,
      personality: record.personality ?? null,
      modelProvider: record.modelProvider ?? 'anthropic',
      modelName: record.modelName ?? null,
    };
  }
}
