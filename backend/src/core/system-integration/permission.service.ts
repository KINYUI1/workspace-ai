import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type { Permission, PermissionRequestDto } from '../../../../shared/types';

export class PermissionService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  /**
   * Request a new permission for an agent.
   * Creates a pending permission record that the user must approve.
   */
  async requestPermission(dto: PermissionRequestDto): Promise<Permission> {
    const permission = await this.db.permission.upsert({
      where: {
        agentId_permissionType_scope: {
          agentId: dto.agentId,
          permissionType: dto.permissionType,
          scope: dto.scope,
        },
      },
      create: {
        agentId: dto.agentId,
        permissionType: dto.permissionType,
        scope: dto.scope,
        duration: dto.duration,
        granted: false,
      },
      update: {
        duration: dto.duration,
        granted: false,
        grantedAt: null,
        expiresAt: null,
      },
    });

    logger.info('Permission requested', {
      permissionId: permission.id,
      agentId: dto.agentId,
      type: dto.permissionType,
    });

    return this.toDto(permission);
  }

  /**
   * Grant or deny a permission request.
   */
  async decide(permissionId: string, granted: boolean): Promise<Permission> {
    const existing = await this.db.permission.findUnique({
      where: { id: permissionId },
    });

    if (!existing) {
      throw new NotFoundError('Permission', permissionId);
    }

    const expiresAt = this.calculateExpiry(existing.duration);

    const permission = await this.db.permission.update({
      where: { id: permissionId },
      data: {
        granted,
        grantedAt: granted ? new Date() : null,
        expiresAt,
      },
    });

    logger.info('Permission decided', {
      permissionId,
      agentId: permission.agentId,
      granted,
    });

    return this.toDto(permission);
  }

  /**
   * Check whether an agent has an active permission.
   */
  async hasPermission(agentId: string, type: string, scope: string): Promise<boolean> {
    const permission = await this.db.permission.findFirst({
      where: {
        agentId,
        permissionType: type,
        granted: true,
        OR: [
          { scope },
          { scope: '*' }, // Wildcard scope
        ],
      },
    });

    if (!permission) return false;

    // Check expiry
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      await this.db.permission.update({
        where: { id: permission.id },
        data: { granted: false },
      });
      return false;
    }

    // For "once" permissions, revoke after check
    if (permission.duration === 'once') {
      await this.db.permission.update({
        where: { id: permission.id },
        data: { granted: false },
      });
    }

    return true;
  }

  /**
   * Get all permissions for an agent.
   */
  async getAgentPermissions(agentId: string): Promise<Permission[]> {
    const permissions = await this.db.permission.findMany({
      where: { agentId },
      orderBy: { grantedAt: 'desc' },
    });

    return permissions.map((p) => this.toDto(p));
  }

  /**
   * Get all pending (ungranted) permission requests for a user's agents.
   */
  async getPendingRequests(userId: string): Promise<Permission[]> {
    const permissions = await this.db.permission.findMany({
      where: {
        agent: { userId },
        granted: false,
        grantedAt: null,
      },
      orderBy: { id: 'desc' },
    });

    return permissions.map((p) => this.toDto(p));
  }

  /**
   * Revoke all permissions for an agent (used during emergency stop).
   */
  async revokeAll(agentId: string): Promise<void> {
    await this.db.permission.updateMany({
      where: { agentId },
      data: { granted: false },
    });

    logger.info('All permissions revoked', { agentId });
  }

  private calculateExpiry(duration: string | null): Date | null {
    if (!duration || duration === 'permanent') return null;
    if (duration === 'once') return null; // Handled during check
    if (duration === 'session') {
      // Session = 24 hours
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      return expiry;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(permission: any): Permission {
    return {
      id: permission.id,
      agentId: permission.agentId,
      permissionType: permission.permissionType,
      scope: permission.scope ?? '',
      granted: permission.granted,
      duration: permission.duration ?? 'once',
      expiresAt: permission.expiresAt,
      grantedAt: permission.grantedAt,
    };
  }
}
