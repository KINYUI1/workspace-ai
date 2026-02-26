import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

interface CronJob {
  id: string;
  name: string;
  expression: string;
  description: string;
  taskDescription: string;
  agentId?: string;
  enabled: boolean;
  userId: string;
  createdAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  history: Array<{ timestamp: string; status: 'success' | 'error'; duration: number; message?: string }>;
}

// In-memory storage
const cronJobs: CronJob[] = [];

/**
 * Parse a cron expression and compute next N run times.
 */
function getNextRuns(expression: string, count = 5): Date[] {
  // Simple cron parser for common patterns
  const dates: Date[] = [];
  const now = new Date();

  for (let i = 1; i <= count * 24; i++) {
    const candidate = new Date(now.getTime() + i * 60 * 60 * 1000);
    // Simplified: just return hourly intervals as placeholders
    dates.push(candidate);
    if (dates.length >= count) break;
  }

  return dates;
}

/**
 * GET /api/cron-jobs
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userJobs = cronJobs
      .filter((j) => j.userId === req.user!.userId)
      .map(({ userId, history, ...rest }) => rest);
    res.json({ data: userJobs });
  }),
);

/**
 * POST /api/cron-jobs
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, expression, description, taskDescription, agentId } = req.body;

    if (!name || !expression) {
      res.status(400).json({ error: 'name and expression are required' });
      return;
    }

    const nextRuns = getNextRuns(expression, 1);
    const job: CronJob = {
      id: crypto.randomUUID(),
      name,
      expression,
      description: description || '',
      taskDescription: taskDescription || '',
      agentId: agentId || undefined,
      enabled: true,
      userId: req.user!.userId,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      nextRunAt: nextRuns[0]?.toISOString() || null,
      history: [],
    };

    cronJobs.push(job);
    const { userId, history, ...rest } = job;
    res.status(201).json({ data: rest });
  }),
);

/**
 * PATCH /api/cron-jobs/:id
 */
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const job = cronJobs.find((j) => j.id === req.params.id && j.userId === req.user!.userId);
    if (!job) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }

    const { name, expression, description, taskDescription, enabled } = req.body;
    if (name !== undefined) job.name = name;
    if (expression !== undefined) {
      job.expression = expression;
      const nextRuns = getNextRuns(expression, 1);
      job.nextRunAt = nextRuns[0]?.toISOString() || null;
    }
    if (description !== undefined) job.description = description;
    if (taskDescription !== undefined) job.taskDescription = taskDescription;
    if (enabled !== undefined) job.enabled = enabled;

    const { userId, history, ...rest } = job;
    res.json({ data: rest });
  }),
);

/**
 * DELETE /api/cron-jobs/:id
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const idx = cronJobs.findIndex((j) => j.id === req.params.id && j.userId === req.user!.userId);
    if (idx === -1) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }
    cronJobs.splice(idx, 1);
    res.json({ ok: true });
  }),
);

/**
 * GET /api/cron-jobs/:id/history
 */
router.get(
  '/:id/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const job = cronJobs.find((j) => j.id === req.params.id && j.userId === req.user!.userId);
    if (!job) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }
    res.json({ data: job.history });
  }),
);

export { router as cronRouter };
