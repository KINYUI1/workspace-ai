import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import { logger } from '../../utils/logger';

// Inline DTOs until shared/types are generated
interface CreateDepartmentDto {
  name: string;
  description?: string;
}

interface UpdateDepartmentDto {
  name?: string;
  description?: string;
}

interface DepartmentDto {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DepartmentService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async create(userId: string, orgId: string, dto: CreateDepartmentDto): Promise<DepartmentDto> {
    // Verify organization ownership
    const organization = await this.db.organization.findFirst({
      where: { id: orgId, userId },
    });

    if (!organization) {
      throw new NotFoundError('Organization', orgId);
    }

    // Enforce unique name per organization (DB constraint also exists)
    const existing = await this.db.department.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictError(`Department with name '${dto.name}' already exists in this organization`, {
        name: dto.name,
        organizationId: orgId,
      });
    }

    const department = await this.db.department.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
      },
    });

    logger.info('Department created', { departmentId: department.id, name: department.name, organizationId: orgId });
    return this.toDto(department);
  }

  async findAll(orgId: string, pagination: PaginationParams) {
    const [departments, total] = await Promise.all([
      this.db.department.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { teams: true } } },
        ...getPaginationOffset(pagination),
      }),
      this.db.department.count({ where: { organizationId: orgId } }),
    ]);

    return {
      data: departments.map((d) => ({
        ...this.toDto(d),
        teamCount: d._count.teams,
      })),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async findById(orgId: string, deptId: string): Promise<DepartmentDto & { teams: unknown[] }> {
    const department = await this.db.department.findFirst({
      where: { id: deptId, organizationId: orgId },
      include: { teams: true },
    });

    if (!department) {
      throw new NotFoundError('Department', deptId);
    }

    return {
      ...this.toDto(department),
      teams: department.teams,
    };
  }

  async update(orgId: string, deptId: string, dto: UpdateDepartmentDto): Promise<DepartmentDto> {
    await this.findById(orgId, deptId);

    // If renaming, check for conflicts within the same organization
    if (dto.name !== undefined) {
      const existing = await this.db.department.findUnique({
        where: { organizationId_name: { organizationId: orgId, name: dto.name } },
      });

      if (existing && existing.id !== deptId) {
        throw new ConflictError(`Department with name '${dto.name}' already exists in this organization`, {
          name: dto.name,
          organizationId: orgId,
        });
      }
    }

    const department = await this.db.department.update({
      where: { id: deptId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    logger.info('Department updated', { departmentId: deptId, organizationId: orgId });
    return this.toDto(department);
  }

  async delete(orgId: string, deptId: string): Promise<void> {
    await this.findById(orgId, deptId);

    // Only allow deletion if the department has no teams
    const teamCount = await this.db.team.count({ where: { departmentId: deptId } });
    if (teamCount > 0) {
      throw new ValidationError(
        'Cannot delete department with teams. Move or remove all teams first.',
      );
    }

    await this.db.department.delete({ where: { id: deptId } });
    logger.info('Department deleted', { departmentId: deptId, organizationId: orgId });
  }

  async addTeam(orgId: string, deptId: string, teamId: string): Promise<void> {
    await this.findById(orgId, deptId);

    await this.db.team.update({
      where: { id: teamId },
      data: { departmentId: deptId },
    });

    logger.info('Team added to department', { departmentId: deptId, teamId });
  }

  async moveDepartment(userId: string, deptId: string, targetOrgId: string): Promise<DepartmentDto> {
    // Verify the department exists
    const department = await this.db.department.findUnique({ where: { id: deptId } });
    if (!department) {
      throw new NotFoundError('Department', deptId);
    }

    // Verify target org exists and is owned by this user
    const targetOrg = await this.db.organization.findFirst({
      where: { id: targetOrgId, userId },
    });
    if (!targetOrg) {
      throw new NotFoundError('Organization', targetOrgId);
    }

    // Can't move to the same org
    if (department.organizationId === targetOrgId) {
      throw new ValidationError('Department is already in this organization.');
    }

    // Check name uniqueness in the target org
    const existing = await this.db.department.findUnique({
      where: { organizationId_name: { organizationId: targetOrgId, name: department.name } },
    });
    if (existing) {
      throw new ConflictError(
        `A department named '${department.name}' already exists in the target organization.`,
        { name: department.name, targetOrgId },
      );
    }

    const updated = await this.db.department.update({
      where: { id: deptId },
      data: { organizationId: targetOrgId },
    });

    logger.info('Department moved', { departmentId: deptId, fromOrgId: department.organizationId, toOrgId: targetOrgId });
    return this.toDto(updated);
  }

  async removeTeam(orgId: string, deptId: string, teamId: string): Promise<void> {
    await this.findById(orgId, deptId);

    await this.db.team.update({
      where: { id: teamId },
      data: { departmentId: null },
    });

    logger.info('Team removed from department', { departmentId: deptId, teamId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(department: any): DepartmentDto {
    return {
      id: department.id,
      organizationId: department.organizationId,
      name: department.name,
      description: department.description ?? '',
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
