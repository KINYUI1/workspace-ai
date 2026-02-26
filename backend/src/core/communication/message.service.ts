import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import type { Message, SendMessageDto } from '../../../../shared/types';

export class MessageService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  /**
   * Send a message from a user or agent to one or more recipients.
   */
  async send(
    dto: SendMessageDto,
    options: { fromAgentId?: string; fromUser?: boolean },
  ): Promise<Message> {
    const message = await this.db.message.create({
      data: {
        fromAgentId: options.fromAgentId ?? null,
        fromUser: options.fromUser ?? false,
        type: dto.type,
        content: dto.content,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        recipients: {
          create: dto.to.map((recipientId) => ({
            agentId: recipientId,
          })),
        },
      },
    });

    logger.info('Message sent', {
      messageId: message.id,
      type: dto.type,
      recipientCount: dto.to.length,
    });

    return this.toDto(message);
  }

  /**
   * Send a broadcast message to all agents (used during sync cycles).
   */
  async broadcast(
    fromAgentId: string,
    content: string,
    agentIds: string[],
    metadata: Record<string, unknown> = {},
  ): Promise<Message> {
    const message = await this.db.message.create({
      data: {
        fromAgentId,
        fromUser: false,
        type: 'broadcast',
        content,
        metadata: metadata as Prisma.InputJsonValue,
        recipients: {
          create: agentIds.map((agentId) => ({ agentId })),
        },
      },
    });

    logger.info('Broadcast sent', {
      messageId: message.id,
      recipientCount: agentIds.length,
    });

    return this.toDto(message);
  }

  /**
   * Get conversation history for an agent (messages sent to or from).
   */
  async getAgentMessages(agentId: string, pagination: PaginationParams) {
    const where = {
      OR: [
        { fromAgentId: agentId },
        { recipients: { some: { agentId } } },
      ],
    };

    const [messages, total] = await Promise.all([
      this.db.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          recipients: { select: { agentId: true, readAt: true } },
          sender: { select: { name: true } },
        },
        ...getPaginationOffset(pagination),
      }),
      this.db.message.count({ where }),
    ]);

    return {
      data: messages.map((m) => this.toDto(m)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  /**
   * Get messages for a team channel.
   */
  async getTeamMessages(teamId: string, pagination: PaginationParams) {
    const where = {
      recipients: { some: { teamId } },
    };

    const [messages, total] = await Promise.all([
      this.db.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...getPaginationOffset(pagination),
      }),
      this.db.message.count({ where }),
    ]);

    return {
      data: messages.map((m) => this.toDto(m)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  /**
   * Mark a message as read by a specific agent.
   */
  async markAsRead(messageId: string, agentId: string): Promise<void> {
    await this.db.messageRecipient.updateMany({
      where: { messageId, agentId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(message: any): Message {
    return {
      id: message.id,
      fromAgentId: message.fromAgentId,
      fromAgentName: message.sender?.name ?? undefined,
      fromUser: message.fromUser,
      type: message.type,
      content: message.content,
      metadata: message.metadata ?? {},
      createdAt: message.createdAt,
    };
  }
}
