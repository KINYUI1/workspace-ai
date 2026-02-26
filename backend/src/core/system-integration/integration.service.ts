import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export interface IntegrationDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  iconUrl: string | null;
  website: string | null;
  authType: string;
  actions: unknown[];
  isActive: boolean;
  createdAt: Date;
}

export interface UserIntegrationDto {
  id: string;
  userId: string;
  integrationId: string;
  status: string;
  config: Record<string, unknown>;
  connectedAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  integration?: IntegrationDto;
}

export interface ConnectIntegrationDto {
  integrationId: string;
  credentials: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export class IntegrationService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async listIntegrations(category?: string): Promise<IntegrationDto[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (category) {
      where.category = category;
    }

    const integrations = await this.db.integration.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return integrations.map((i) => this.toIntegrationDto(i));
  }

  async getIntegration(id: string): Promise<IntegrationDto> {
    const integration = await this.db.integration.findUnique({ where: { id } });
    if (!integration) {
      throw new NotFoundError('Integration', id);
    }
    return this.toIntegrationDto(integration);
  }

  async getUserConnections(userId: string): Promise<UserIntegrationDto[]> {
    const connections = await this.db.userIntegration.findMany({
      where: { userId },
      include: { integration: true },
      orderBy: { connectedAt: 'desc' },
    });

    return connections.map((c) => this.toUserIntegrationDto(c));
  }

  async connectIntegration(userId: string, dto: ConnectIntegrationDto): Promise<UserIntegrationDto> {
    const integration = await this.db.integration.findUnique({
      where: { id: dto.integrationId },
    });

    if (!integration) {
      throw new NotFoundError('Integration', dto.integrationId);
    }

    // Check if already connected
    const existing = await this.db.userIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId: dto.integrationId } },
    });

    if (existing && existing.status === 'connected') {
      throw new ConflictError('Integration is already connected');
    }

    const connection = await this.db.userIntegration.upsert({
      where: { userId_integrationId: { userId, integrationId: dto.integrationId } },
      update: {
        status: 'connected',
        credentials: dto.credentials as Prisma.InputJsonValue,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        connectedAt: new Date(),
      },
      create: {
        userId,
        integrationId: dto.integrationId,
        status: 'connected',
        credentials: dto.credentials as Prisma.InputJsonValue,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
      include: { integration: true },
    });

    logger.info('Integration connected', {
      userId,
      integrationId: dto.integrationId,
      integrationName: integration.name,
    });

    return this.toUserIntegrationDto(connection);
  }

  async disconnectIntegration(userId: string, integrationId: string): Promise<void> {
    const connection = await this.db.userIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });

    if (!connection) {
      throw new NotFoundError('UserIntegration', integrationId);
    }

    await this.db.userIntegration.update({
      where: { id: connection.id },
      data: { status: 'disconnected', credentials: {} as Prisma.InputJsonValue },
    });

    logger.info('Integration disconnected', { userId, integrationId });
  }

  async updateConnectionConfig(
    userId: string,
    integrationId: string,
    config: Record<string, unknown>,
  ): Promise<UserIntegrationDto> {
    const connection = await this.db.userIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
      include: { integration: true },
    });

    if (!connection) {
      throw new NotFoundError('UserIntegration', integrationId);
    }

    const updated = await this.db.userIntegration.update({
      where: { id: connection.id },
      data: { config: config as Prisma.InputJsonValue },
      include: { integration: true },
    });

    return this.toUserIntegrationDto(updated);
  }

  async getConnectionLogs(userId: string, integrationId: string, limit = 50) {
    const connection = await this.db.userIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });

    if (!connection) {
      throw new NotFoundError('UserIntegration', integrationId);
    }

    const logs = await this.db.integrationLog.findMany({
      where: { userIntegrationId: connection.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toIntegrationDto(i: any): IntegrationDto {
    return {
      id: i.id,
      name: i.name,
      slug: i.slug,
      description: i.description,
      category: i.category,
      iconUrl: i.iconUrl,
      website: i.website,
      authType: i.authType,
      actions: i.actions as unknown[],
      isActive: i.isActive,
      createdAt: i.createdAt,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toUserIntegrationDto(c: any): UserIntegrationDto {
    return {
      id: c.id,
      userId: c.userId,
      integrationId: c.integrationId,
      status: c.status,
      config: c.config as Record<string, unknown>,
      connectedAt: c.connectedAt,
      lastUsedAt: c.lastUsedAt,
      expiresAt: c.expiresAt,
      ...(c.integration ? { integration: this.toIntegrationDto(c.integration) } : {}),
    };
  }
}
