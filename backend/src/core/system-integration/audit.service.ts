import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import type { AuditLogEntry } from '../../../../shared/types';

export class AuditService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async log(entry: {
    agentId?: string;
    action: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
    result?: Record<string, unknown>;
    success: boolean;
  }): Promise<void> {
    await this.db.auditLog.create({
      data: {
        agentId: entry.agentId ?? null,
        action: entry.action,
        toolName: entry.toolName ?? null,
        parameters: (entry.parameters ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        result: (entry.result ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        success: entry.success,
      },
    });
  }

  async getByAgent(agentId: string, pagination: PaginationParams) {
    const where = { agentId };

    const [entries, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...getPaginationOffset(pagination),
      }),
      this.db.auditLog.count({ where }),
    ]);

    return {
      data: entries.map((e) => this.toDto(e)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async getAll(userId: string, pagination: PaginationParams) {
    const where = { agent: { userId } };

    const [entries, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...getPaginationOffset(pagination),
      }),
      this.db.auditLog.count({ where }),
    ]);

    return {
      data: entries.map((e) => this.toDto(e)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(entry: any): AuditLogEntry {
    return {
      id: entry.id,
      agentId: entry.agentId,
      action: entry.action,
      toolName: entry.toolName,
      parameters: entry.parameters,
      result: entry.result,
      success: entry.success,
      createdAt: entry.createdAt,
    };
  }
}
