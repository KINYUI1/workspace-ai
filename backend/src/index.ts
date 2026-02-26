import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { getPrismaClient, disconnectDatabase } from './config/database';
import { initializeWebSocket } from './core/communication/websocket';
import { SyncScheduler } from './core/communication/sync-scheduler';
import { SchedulerService } from './core/orchestration/scheduler.service';
import { registerBuiltinChannelAdapters } from './core/channels';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  // Register built-in channel adapters (Telegram, Discord, Slack, etc.)
  registerBuiltinChannelAdapters();

  // Verify database connection
  const prisma = getPrismaClient();
  await prisma.$connect();
  logger.info('Database connected');

  // Create Express app and HTTP server
  const app = createApp();
  const httpServer = createServer(app);

  // Initialize WebSocket
  initializeWebSocket(httpServer);

  // Start sync scheduler
  const syncIntervalMinutes = env.SYNC_INTERVAL_MINUTES;
  const syncScheduler = new SyncScheduler(env.ANTHROPIC_API_KEY, syncIntervalMinutes);
  syncScheduler.start();

  // Start scheduled task worker (BullMQ)
  const schedulerService = new SchedulerService();
  schedulerService.startWorker();

  // Start listening
  httpServer.listen(env.PORT, () => {
    logger.info(`Workspace AI server started`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      syncInterval: `${syncIntervalMinutes} minutes`,
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful Shutdown
  // ---------------------------------------------------------------------------

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop sync scheduler
    syncScheduler.stop();

    // Stop scheduler worker
    await schedulerService.stopWorker();

    // Disconnect database
    await disconnectDatabase();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});
