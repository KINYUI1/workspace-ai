import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * Manages chat sessions (conversations) for users.
 *
 * NOTE: The ChatSession model may not exist in the Prisma schema yet.
 * This service uses $queryRaw / $executeRaw so it compiles regardless.
 * Once the model is added to schema.prisma and migrated, these can be
 * replaced with typed Prisma client calls.
 */
export class SessionService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  /**
   * Create a new chat session for the given user.
   */
  async createSession(
    userId: string,
    name?: string,
    agentId?: string,
  ): Promise<any> {
    const id = crypto.randomUUID();
    const sessionName = name ?? 'New Chat';
    const now = new Date();

    await this.db.$executeRaw`
      INSERT INTO "ChatSession" ("id", "userId", "agentId", "name", "createdAt", "updatedAt")
      VALUES (${id}, ${userId}, ${agentId ?? null}, ${sessionName}, ${now}, ${now})
    `;

    logger.info('Chat session created', { sessionId: id, userId });

    return {
      id,
      userId,
      agentId: agentId ?? null,
      name: sessionName,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * List all sessions for a user, most recently updated first.
   */
  async listSessions(userId: string): Promise<any[]> {
    const sessions: any[] = await this.db.$queryRaw`
      SELECT "id", "userId", "agentId", "name", "createdAt", "updatedAt"
      FROM "ChatSession"
      WHERE "userId" = ${userId}
      ORDER BY "updatedAt" DESC
    `;

    return sessions;
  }

  /**
   * Get a single session, ensuring it belongs to the requesting user.
   */
  async getSession(sessionId: string, userId: string): Promise<any> {
    const rows: any[] = await this.db.$queryRaw`
      SELECT "id", "userId", "agentId", "name", "createdAt", "updatedAt"
      FROM "ChatSession"
      WHERE "id" = ${sessionId} AND "userId" = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundError('Chat session not found');
    }

    return rows[0];
  }

  /**
   * Rename a session.
   */
  async renameSession(
    sessionId: string,
    userId: string,
    name: string,
  ): Promise<any> {
    // Verify ownership first
    await this.getSession(sessionId, userId);

    const now = new Date();
    await this.db.$executeRaw`
      UPDATE "ChatSession"
      SET "name" = ${name}, "updatedAt" = ${now}
      WHERE "id" = ${sessionId} AND "userId" = ${userId}
    `;

    logger.info('Chat session renamed', { sessionId, name });

    return this.getSession(sessionId, userId);
  }

  /**
   * Delete a session and all its associated messages.
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    // Verify ownership first
    await this.getSession(sessionId, userId);

    // Delete messages belonging to this session first
    await this.db.$executeRaw`
      DELETE FROM "Message"
      WHERE "sessionId" = ${sessionId}
    `;

    await this.db.$executeRaw`
      DELETE FROM "ChatSession"
      WHERE "id" = ${sessionId} AND "userId" = ${userId}
    `;

    logger.info('Chat session deleted', { sessionId, userId });
  }
}
