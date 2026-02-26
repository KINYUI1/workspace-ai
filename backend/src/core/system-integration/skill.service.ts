import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { logger } from '../../utils/logger';

export interface SkillDto {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  toolDefinition: Record<string, unknown>;
  handlerType: string;
  handlerConfig: Record<string, unknown>;
  isPublic: boolean;
  createdAt: Date;
}

export interface CreateSkillDto {
  name: string;
  description: string;
  toolDefinition: Record<string, unknown>;
  handlerType: 'webhook' | 'builtin';
  handlerConfig: Record<string, unknown>;
  isPublic?: boolean;
}

export class SkillService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async createSkill(userId: string, dto: CreateSkillDto): Promise<SkillDto> {
    const skill = await this.db.skill.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        toolDefinition: dto.toolDefinition as unknown as Prisma.InputJsonValue,
        handlerType: dto.handlerType,
        handlerConfig: dto.handlerConfig as unknown as Prisma.InputJsonValue,
        isPublic: dto.isPublic ?? false,
      },
    });
    logger.info('Skill created', { skillId: skill.id, name: skill.name });
    return this.toDto(skill);
  }

  async listSkills(userId: string): Promise<SkillDto[]> {
    const skills = await this.db.skill.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, isPublic: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return skills.map((s) => this.toDto(s));
  }

  async getSkillsForAgent(agentId: string): Promise<SkillDto[]> {
    const agentSkills = await this.db.agentSkill.findMany({
      where: { agentId },
      include: { skill: true },
    });
    return agentSkills.map((as) => this.toDto(as.skill));
  }

  async enableSkill(agentId: string, skillId: string): Promise<void> {
    await this.db.agentSkill.upsert({
      where: { agentId_skillId: { agentId, skillId } },
      create: { agentId, skillId },
      update: {},
    });
    logger.info('Skill enabled for agent', { agentId, skillId });
  }

  async disableSkill(agentId: string, skillId: string): Promise<void> {
    await this.db.agentSkill.deleteMany({
      where: { agentId, skillId },
    });
    logger.info('Skill disabled for agent', { agentId, skillId });
  }

  async executeSkill(skillId: string, input: Record<string, unknown>): Promise<unknown> {
    const skill = await this.db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);

    const config = skill.handlerConfig as Record<string, unknown>;

    if (skill.handlerType === 'webhook') {
      const webhookUrl = config.webhookUrl as string;
      if (!webhookUrl) throw new Error('Webhook URL not configured for skill');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      return result;
    }

    if (skill.handlerType === 'builtin') {
      // Builtin skills can be added later
      throw new Error(`Builtin skill handler "${config.builtinId}" not implemented`);
    }

    throw new Error(`Unknown handler type: ${skill.handlerType}`);
  }

  async deleteSkill(userId: string, skillId: string): Promise<void> {
    await this.db.skill.deleteMany({
      where: { id: skillId, userId },
    });
    logger.info('Skill deleted', { skillId, userId });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(skill: any): SkillDto {
    return {
      id: skill.id,
      userId: skill.userId,
      name: skill.name,
      description: skill.description,
      toolDefinition: skill.toolDefinition as Record<string, unknown>,
      handlerType: skill.handlerType,
      handlerConfig: skill.handlerConfig as Record<string, unknown>,
      isPublic: skill.isPublic,
      createdAt: skill.createdAt,
    };
  }
}
