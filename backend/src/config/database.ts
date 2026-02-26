import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

/**
 * Inject an externally-created PrismaClient (e.g. desktop SQLite client).
 * Must be called before any getPrismaClient() call.
 */
export function setPrismaClient(client: PrismaClient): void {
  prisma = client;
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    prisma.$on('error' as never, (e: { message: string }) => {
      logger.error('Prisma error', { error: e.message });
    });

    prisma.$on('warn' as never, (e: { message: string }) => {
      logger.warn('Prisma warning', { warning: e.message });
    });
  }

  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}
