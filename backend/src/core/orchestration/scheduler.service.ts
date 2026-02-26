import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { env, DESKTOP_MODE } from '../../config/env';
import { logger } from '../../utils/logger';
import { TaskDispatcher } from './task-dispatcher';
import { TaskService } from './task.service';

const QUEUE_NAME = 'scheduled-tasks';

// ---------------------------------------------------------------------------
// In desktop mode we use in-process timers instead of BullMQ + Redis.
// ---------------------------------------------------------------------------

// In-process timer store for desktop mode
const localTimers = new Map<string, ReturnType<typeof setTimeout>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localCronImport: any = null;

async function getNodeCron(): Promise<any> {
  if (!localCronImport) {
    localCronImport = await import('node-cron');
  }
  return localCronImport;
}

function getRedisOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    maxRetriesPerRequest: null as null,
  };
}

export class SchedulerService {
  private readonly db: PrismaClient;
  private queue: any = null;
  private worker: any = null;
  private redisAvailable = true;

  constructor() {
    this.db = getPrismaClient();
  }

  private getQueue(): any {
    if (DESKTOP_MODE) return null; // No BullMQ in desktop mode
    if (!this.queue) {
      const { Queue } = require('bullmq');
      this.queue = new Queue(QUEUE_NAME, { connection: getRedisOpts() });
      this.queue.on('error', (err: Error) => {
        if (!this.redisAvailable) return;
        this.redisAvailable = false;
        logger.warn('Redis unavailable — scheduled tasks disabled', { error: err.message });
      });
    }
    return this.queue;
  }

  async scheduleOnce(userId: string, agentId: string | null, title: string, description: string, runAt: Date): Promise<any> {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    const record = await this.db.scheduledTask.create({
      data: {
        userId, agentId, title, description,
        scheduleType: 'once',
        runAt,
        enabled: true,
        nextRunAt: runAt,
      },
    });

    if (DESKTOP_MODE) {
      // In-process timer
      const timer = setTimeout(() => {
        this.processLocalJob(record.id, userId, agentId, title, description);
        localTimers.delete(record.id);
      }, delay);
      localTimers.set(record.id, timer);
      await this.db.scheduledTask.update({ where: { id: record.id }, data: { jobId: `local-${record.id}` } });
    } else {
      try {
        const job = await this.getQueue().add('run-task', { scheduledTaskId: record.id, userId, agentId, title, description }, { delay, jobId: `st-${record.id}` });
        await this.db.scheduledTask.update({ where: { id: record.id }, data: { jobId: job.id } });
      } catch (e) {
        logger.warn('Could not enqueue scheduled task (Redis unavailable)', { title, error: (e as Error).message });
      }
    }
    return record;
  }

  async scheduleCron(userId: string, agentId: string | null, title: string, description: string, cronExpression: string): Promise<any> {
    const record = await this.db.scheduledTask.create({
      data: {
        userId, agentId, title, description,
        scheduleType: 'cron',
        cronExpression,
        enabled: true,
      },
    });

    if (DESKTOP_MODE) {
      // In-process cron
      try {
        const nodeCron = await getNodeCron();
        const task = nodeCron.schedule(cronExpression, () => {
          this.processLocalJob(record.id, userId, agentId, title, description);
        });
        localTimers.set(record.id, task as any);
        await this.db.scheduledTask.update({ where: { id: record.id }, data: { jobId: `local-${record.id}` } });
      } catch (e) {
        logger.warn('Invalid cron expression', { cronExpression, error: (e as Error).message });
      }
    } else {
      try {
        const job = await this.getQueue().add('run-task', { scheduledTaskId: record.id, userId, agentId, title, description }, {
          repeat: { pattern: cronExpression },
          jobId: `st-${record.id}`,
        });
        await this.db.scheduledTask.update({ where: { id: record.id }, data: { jobId: typeof job.id === 'string' ? job.id : `st-${record.id}` } });
      } catch (e) {
        logger.warn('Could not enqueue cron task (Redis unavailable)', { title, error: (e as Error).message });
      }
    }
    return record;
  }

  async cancelScheduledTask(scheduledTaskId: string): Promise<void> {
    const record = await this.db.scheduledTask.findUnique({ where: { id: scheduledTaskId } });
    if (!record) return;

    if (DESKTOP_MODE) {
      const timer = localTimers.get(scheduledTaskId);
      if (timer) {
        if (typeof (timer as any).stop === 'function') {
          (timer as any).stop(); // node-cron task
        } else {
          clearTimeout(timer); // setTimeout
        }
        localTimers.delete(scheduledTaskId);
      }
    } else if (record.jobId) {
      try {
        const queue = this.getQueue();
        await queue.remove(record.jobId);
        if (record.scheduleType === 'cron' && record.cronExpression) {
          const repeatables = await queue.getRepeatableJobs();
          const match = repeatables.find((r: any) => r.id === record.jobId || r.key.includes(record.jobId!));
          if (match) await queue.removeRepeatableByKey(match.key);
        }
      } catch (e) {
        logger.warn('Failed to remove BullMQ job', { jobId: record.jobId, error: (e as Error).message });
      }
    }

    await this.db.scheduledTask.update({ where: { id: scheduledTaskId }, data: { enabled: false } });
  }

  async listForUser(userId: string) {
    return this.db.scheduledTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  startWorker(): void {
    if (DESKTOP_MODE) {
      // In desktop mode, reload active scheduled tasks from DB
      this.reloadLocalJobs().catch((err) => {
        logger.warn('Could not reload local scheduled jobs', { error: (err as Error).message });
      });
      logger.info('Local scheduler started (in-process mode)');
      return;
    }

    if (this.worker) return;
    try {
      const { Worker } = require('bullmq');
      this.worker = new Worker(QUEUE_NAME, async (job: any) => {
        await this.processJob(job);
      }, { connection: getRedisOpts() });

      this.worker.on('failed', (job: any, err: Error) => {
        logger.error('Scheduled task job failed', { jobId: job?.id, error: err.message });
      });

      this.worker.on('error', (err: Error) => {
        if (!this.redisAvailable) return;
        this.redisAvailable = false;
        logger.warn('Scheduler worker Redis error — worker disabled', { error: err.message });
      });

      logger.info('Scheduler worker started');
    } catch (e) {
      logger.warn('Could not start scheduler worker (Redis unavailable)', { error: (e as Error).message });
    }
  }

  async stopWorker(): Promise<void> {
    if (DESKTOP_MODE) {
      // Cancel all local timers
      for (const [id, timer] of localTimers) {
        if (typeof (timer as any).stop === 'function') {
          (timer as any).stop();
        } else {
          clearTimeout(timer);
        }
        localTimers.delete(id);
      }
      return;
    }

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  /**
   * Reload active jobs from DB on startup (desktop mode).
   */
  private async reloadLocalJobs(): Promise<void> {
    const tasks = await this.db.scheduledTask.findMany({
      where: { enabled: true },
    });

    for (const task of tasks) {
      if (task.scheduleType === 'once' && task.runAt) {
        const delay = task.runAt.getTime() - Date.now();
        if (delay > 0) {
          const timer = setTimeout(() => {
            this.processLocalJob(task.id, task.userId, task.agentId, task.title, task.description);
            localTimers.delete(task.id);
          }, delay);
          localTimers.set(task.id, timer);
        }
      } else if (task.scheduleType === 'cron' && task.cronExpression) {
        try {
          const nodeCron = await getNodeCron();
          const cronTask = nodeCron.schedule(task.cronExpression, () => {
            this.processLocalJob(task.id, task.userId, task.agentId, task.title, task.description);
          });
          localTimers.set(task.id, cronTask as any);
        } catch {
          // Invalid expression — skip
        }
      }
    }

    logger.info(`Reloaded ${localTimers.size} scheduled jobs from DB`);
  }

  /**
   * Process a job locally (desktop mode — same logic as BullMQ processJob).
   */
  private async processLocalJob(
    scheduledTaskId: string,
    userId: string,
    agentId: string | null,
    title: string,
    description: string,
  ): Promise<void> {
    logger.info('Processing scheduled task (local)', { scheduledTaskId, title });

    try {
      const taskService = new TaskService();
      const taskDispatcher = new TaskDispatcher();

      const task = await taskService.create(userId, {
        title,
        description,
        priority: 'medium',
        assignTo: agentId ? [agentId] : undefined,
      });

      if (agentId) {
        taskDispatcher.dispatch(task.id, userId).catch((err) => {
          logger.error('Scheduled task dispatch failed', { taskId: task.id, error: (err as Error).message });
        });
      }

      await this.db.scheduledTask.update({
        where: { id: scheduledTaskId },
        data: { lastRunAt: new Date() },
      });
    } catch (error) {
      logger.error('Scheduled task processing failed', { scheduledTaskId, error: (error as Error).message });
    }
  }

  private async processJob(job: any): Promise<void> {
    const { scheduledTaskId, userId, agentId, title, description } = job.data;
    await this.processLocalJob(scheduledTaskId, userId, agentId, title, description);
  }
}
