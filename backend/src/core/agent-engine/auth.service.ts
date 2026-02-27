import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { UnauthorizedError, ConflictError } from '../../utils/errors';
import { generateToken, AuthPayload } from '../../api/middleware/auth';
import { logger } from '../../utils/logger';
import { DESKTOP_MODE } from '../../config/env';

const SALT_ROUNDS = 12;

export class AuthService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async register(email: string, password: string, name: string): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.db.user.create({
      data: { email, password: hashedPassword, name },
    });

    // Create default Atlas agent for the new user
    const atlas = await this.db.agent.create({
      data: {
        userId: user.id,
        name: 'Atlas',
        role: 'Main Orchestrator',
        specialty: ['task delegation', 'team management', 'strategic planning'],
        isMainAgent: true,
        status: 'active',
        capabilities: [
          'create_task',
          'create_team',
          'send_message',
          'broadcast',
          'manage_agents',
        ],
      },
    });
    await this.db.agentContext.create({ data: { agentId: atlas.id } });

    const payload: AuthPayload = { userId: user.id, email: user.email };
    const token = generateToken(payload);

    logger.info('User registered', { userId: user.id, email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: AuthPayload = { userId: user.id, email: user.email };
    const token = generateToken(payload);

    logger.info('User logged in', { userId: user.id, email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async getProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, settings: true, createdAt: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return user;
  }

  /**
   * Desktop mode: get or create a local user and return a long-lived token.
   * No password required — single-user local app.
   */
  async getDesktopToken(): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
    // Find the first (and only) user
    let user = await this.db.user.findFirst();

    if (!user) {
      // Auto-create if missing (shouldn't happen — seeded on first boot)
      const hashedPassword = await bcrypt.hash('desktop-local', SALT_ROUNDS);
      user = await this.db.user.create({
        data: {
          email: 'local@workspace-ai.local',
          password: hashedPassword,
          name: 'Local User',
          settings: DESKTOP_MODE ? '{}' : {},
        },
      });
      logger.info('Desktop user auto-created', { userId: user.id });
    }

    const payload: AuthPayload = { userId: user.id, email: user.email };
    const token = generateToken(payload);

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
