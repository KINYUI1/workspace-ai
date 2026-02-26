import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors';
import { getPaginationOffset, buildPaginationMeta, PaginationParams } from '../../utils/pagination';
import { logger } from '../../utils/logger';

// Inline DTOs until shared/types are generated
interface CreateOrganizationDto {
  name: string;
  description?: string;
}

interface UpdateOrganizationDto {
  name?: string;
  description?: string;
}

interface OrganizationDto {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  departments?: { id: string; name: string; description: string; teams: { id: string; name: string; agents: { id: string; name: string; role: string; status: string }[] }[] }[];
}

export class OrganizationService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationDto> {
    // Enforce unique name per user (DB constraint also exists)
    const existing = await this.db.organization.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictError(`Organization with name '${dto.name}' already exists`, {
        name: dto.name,
      });
    }

    const organization = await this.db.organization.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
    });

    logger.info('Organization created', { organizationId: organization.id, name: organization.name, userId });
    return { ...this.toDto(organization), departments: [] };
  }

  async findAll(userId: string, pagination: PaginationParams) {
    const [organizations, total] = await Promise.all([
      this.db.organization.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          departments: {
            include: {
              teams: {
                include: {
                  agents: {
                    select: { id: true, name: true, role: true, status: true },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          },
        },
        ...getPaginationOffset(pagination),
      }),
      this.db.organization.count({ where: { userId } }),
    ]);

    return {
      data: organizations.map((o) => ({
        ...this.toDto(o),
        departmentCount: o.departments.length,
        departments: o.departments.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? '',
          teams: d.teams.map((t) => ({
            id: t.id,
            name: t.name,
            agents: t.agents.map((a) => ({
              id: a.id,
              name: a.name,
              role: a.role,
              status: a.status,
            })),
          })),
        })),
      })),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async findById(userId: string, orgId: string): Promise<OrganizationDto> {
    const organization = await this.db.organization.findFirst({
      where: { id: orgId, userId },
      include: {
        departments: {
          include: {
            teams: {
              include: {
                agents: {
                  select: { id: true, name: true, role: true, status: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!organization) {
      throw new NotFoundError('Organization', orgId);
    }

    return {
      ...this.toDto(organization),
      departments: organization.departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? '',
        teams: d.teams.map((t) => ({
          id: t.id,
          name: t.name,
          agents: t.agents.map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            status: a.status,
          })),
        })),
      })),
    };
  }

  async update(userId: string, orgId: string, dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    await this.findById(userId, orgId);

    // If renaming, check for conflicts
    if (dto.name !== undefined) {
      const existing = await this.db.organization.findUnique({
        where: { userId_name: { userId, name: dto.name } },
      });

      if (existing && existing.id !== orgId) {
        throw new ConflictError(`Organization with name '${dto.name}' already exists`, {
          name: dto.name,
        });
      }
    }

    const organization = await this.db.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    logger.info('Organization updated', { organizationId: orgId, userId });
    return this.toDto(organization);
  }

  async delete(userId: string, orgId: string): Promise<void> {
    await this.findById(userId, orgId);

    // Only allow deletion if the organization has no departments
    const deptCount = await this.db.department.count({ where: { organizationId: orgId } });
    if (deptCount > 0) {
      throw new ValidationError(
        'Cannot delete organization with departments. Remove all departments first.',
      );
    }

    await this.db.organization.delete({ where: { id: orgId } });
    logger.info('Organization deleted', { organizationId: orgId, userId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(organization: any): OrganizationDto {
    return {
      id: organization.id,
      userId: organization.userId,
      name: organization.name,
      description: organization.description ?? '',
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}
