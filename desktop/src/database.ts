// ---------------------------------------------------------------------------
// Desktop Database Module
// Uses the SQLite-specific Prisma client generated from schema.desktop.prisma
// ---------------------------------------------------------------------------

import path from 'path';

let prisma: any;

/**
 * Get or create the desktop PrismaClient (SQLite).
 * We use require() to load from the custom output directory
 * (.prisma/client-desktop) so it doesn't conflict with the
 * PostgreSQL client used by the web backend.
 */
export function getDesktopPrismaClient(): any {
  if (!prisma) {
    const clientPath = path.resolve(
      __dirname, '..', '..', 'node_modules', '.prisma', 'client-desktop',
    );
    const { PrismaClient } = require(clientPath);
    prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  return prisma;
}

/**
 * Disconnect the desktop Prisma client.
 */
export async function disconnectDesktopDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    console.log('[desktop] Database disconnected');
  }
}
