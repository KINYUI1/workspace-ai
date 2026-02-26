import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { MessageService } from './message.service';
import { AgentRuntime } from '../agent-engine/agent-runtime';
import { emitToUser, emitStreamEvent } from './websocket';
import type { Agent, AgentStats, SendMessageDto } from '../../../../shared/types';

/**
 * ChatService orchestrates the full request-reply cycle for user messages.
 *
 * Flow:
 *  1. Persist the user message via MessageService.
 *  2. If the main agent is among the recipients, invoke AgentRuntime.processMessage().
 *  3. Persist the agent reply and emit it to the user over WebSocket.
 *
 * Supports both buffered (processMessage) and streaming (processMessageStream) modes.
 */
export class ChatService {
  private readonly db: PrismaClient;
  private readonly messageService: MessageService;

  constructor() {
    this.db = getPrismaClient();
    this.messageService = new MessageService();
  }

  async handleUserMessage(dto: SendMessageDto, userId: string): Promise<void> {
    // 1. Save the user message
    await this.messageService.send(dto, { fromUser: true });

    // 2. Process each recipient agent
    for (const agentId of dto.to) {
      const agentRecord = await this.db.agent.findFirst({
        where: { id: agentId, userId },
      });

      if (!agentRecord) continue;

      logger.info('Routing user message to agent', {
        agentId: agentRecord.id,
        agentName: agentRecord.name,
        isMain: agentRecord.isMainAgent,
        userId,
      });

      // Fire-and-forget so the HTTP response isn't blocked
      // Use streaming by default for real-time UX
      this.processAgentReplyStream(agentRecord, dto.content, userId).catch((error) => {
        logger.error('Failed to get AI reply (streaming)', {
          agentId: agentRecord.id,
          error: (error as Error).message,
        });

        emitToUser(userId, 'agent:message', {
          id: uuidv4(),
          agentId: agentRecord.id,
          agentName: agentRecord.name,
          content: 'I encountered an error processing your message. Please try again.',
          timestamp: new Date().toISOString(),
        });
      });
    }
  }

  /**
   * Stream agent reply in real-time via Socket.io events.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async processAgentReplyStream(agentRecord: any, content: string, userId: string): Promise<void> {
    const agentDto = this.toAgentDto(agentRecord);
    const runtime = new AgentRuntime(agentDto, env.ANTHROPIC_API_KEY);
    const messageId = uuidv4();
    let fullReply = '';

    try {
      for await (const event of runtime.processMessageStream(content, 'User')) {
        switch (event.type) {
          case 'stream_start':
            emitStreamEvent(userId, 'agent:stream:start', {
              messageId,
              agentId: agentRecord.id,
              agentName: agentRecord.name,
              timestamp: new Date().toISOString(),
            });
            break;

          case 'text_delta':
            emitStreamEvent(userId, 'agent:stream:delta', {
              messageId,
              agentId: agentRecord.id,
              text: event.text,
            });
            break;

          case 'thinking_delta':
            emitStreamEvent(userId, 'agent:stream:thinking', {
              messageId,
              agentId: agentRecord.id,
              text: event.text,
            });
            break;

          case 'tool_use_start':
            emitStreamEvent(userId, 'agent:stream:tool_use', {
              messageId,
              agentId: agentRecord.id,
              agentName: agentRecord.name,
              toolId: event.toolId,
              toolName: event.toolName,
              input: event.input,
            });
            break;

          case 'tool_result':
            emitStreamEvent(userId, 'agent:stream:tool_result', {
              messageId,
              agentId: agentRecord.id,
              toolId: event.toolId,
              toolName: event.toolName,
              result: event.result,
              durationMs: event.durationMs,
            });
            break;

          case 'usage':
            emitStreamEvent(userId, 'agent:stream:usage', {
              messageId,
              agentId: agentRecord.id,
              inputTokens: event.inputTokens,
              outputTokens: event.outputTokens,
            });
            break;

          case 'stream_done':
            fullReply = event.fullText;
            break;

          case 'stream_error':
            emitStreamEvent(userId, 'agent:stream:error', {
              messageId,
              agentId: agentRecord.id,
              error: event.error,
            });
            return;
        }
      }

      // Persist the agent reply
      await this.messageService.send(
        { to: [], type: 'direct', content: fullReply },
        { fromAgentId: agentRecord.id },
      );

      // Emit done event with the final message for the frontend to finalize
      emitStreamEvent(userId, 'agent:stream:done', {
        messageId,
        agentId: agentRecord.id,
        agentName: agentRecord.name,
        content: fullReply,
        timestamp: new Date().toISOString(),
      });

      logger.info('Agent streaming reply complete', {
        agentId: agentRecord.id,
        replyLength: fullReply.length,
      });
    } catch (error) {
      logger.error('Streaming reply failed', {
        agentId: agentRecord.id,
        error: (error as Error).message,
      });

      emitToUser(userId, 'agent:message', {
        id: messageId,
        agentId: agentRecord.id,
        agentName: agentRecord.name,
        content: 'I encountered an error processing your message. Please try again.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Convert a DB agent record to the Agent DTO.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toAgentDto(agentRecord: any): Agent {
    return {
      id: agentRecord.id,
      userId: agentRecord.userId,
      teamId: agentRecord.teamId,
      name: agentRecord.name,
      role: agentRecord.role,
      specialty: agentRecord.specialty,
      status: agentRecord.status as Agent['status'],
      isMainAgent: agentRecord.isMainAgent,
      contextId: agentRecord.contextId,
      currentTaskId: agentRecord.currentTaskId,
      capabilities: agentRecord.capabilities,
      createdAt: agentRecord.createdAt,
      lastActive: agentRecord.lastActive,
      lastSyncAt: agentRecord.lastSyncAt,
      stats: agentRecord.stats as unknown as AgentStats,
      personality: agentRecord.personality ?? null,
      modelProvider: agentRecord.modelProvider ?? 'anthropic',
      modelName: agentRecord.modelName ?? null,
    };
  }
}
