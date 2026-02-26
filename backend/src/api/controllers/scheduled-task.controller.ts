import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { SchedulerService } from '../../core/orchestration/scheduler.service';

const router = Router();
const schedulerService = new SchedulerService();

router.use(authenticate);

const createScheduledTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  scheduleType: z.enum(['once', 'cron']),
  runAt: z.string().datetime().optional(),
  cronExpression: z.string().max(100).optional(),
  agentId: z.string().uuid().optional(),
}).refine(
  (data) => {
    if (data.scheduleType === 'once') return !!data.runAt;
    if (data.scheduleType === 'cron') return !!data.cronExpression;
    return false;
  },
  { message: 'once requires runAt, cron requires cronExpression' },
);

// GET /api/scheduled-tasks — list user's scheduled tasks
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tasks = await schedulerService.listForUser(req.user!.userId);
    res.json({ success: true, data: tasks });
  }),
);

// POST /api/scheduled-tasks — create a scheduled task
router.post(
  '/',
  validate(createScheduledTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, description, scheduleType, runAt, cronExpression, agentId } = req.body;
    let scheduled;
    if (scheduleType === 'once') {
      scheduled = await schedulerService.scheduleOnce(
        req.user!.userId,
        agentId ?? null,
        title,
        description,
        new Date(runAt),
      );
    } else {
      scheduled = await schedulerService.scheduleCron(
        req.user!.userId,
        agentId ?? null,
        title,
        description,
        cronExpression,
      );
    }
    res.status(201).json({ success: true, data: scheduled });
  }),
);

// DELETE /api/scheduled-tasks/:id — cancel a scheduled task
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await schedulerService.cancelScheduledTask(req.params.id);
    res.json({ success: true });
  }),
);

export const scheduledTaskRouter = router;
