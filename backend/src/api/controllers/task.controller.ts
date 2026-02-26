import { Router, Request, Response } from 'express';
import { TaskService } from '../../core/orchestration/task.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { createTaskSchema, updateTaskSchema, paginationSchema } from '../validators/schemas';

const router = Router();
const taskService = new TaskService();

router.use(authenticate);

/**
 * POST /api/tasks
 * Create a new task.
 */
router.post(
  '/',
  validate(createTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.create(req.user!.userId, req.body);

    res.status(201).json({
      success: true,
      data: task,
    });
  }),
);

/**
 * GET /api/tasks
 * List all tasks with optional filters.
 */
router.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const filters = {
      status: req.query.status as string | undefined,
      teamId: req.query.teamId as string | undefined,
      priority: req.query.priority as string | undefined,
    };

    const result = await taskService.findAll(req.user!.userId, { page, limit }, filters);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

/**
 * GET /api/tasks/:id
 * Get a specific task.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.findById(req.user!.userId, req.params.id);

    res.json({
      success: true,
      data: task,
    });
  }),
);

/**
 * PATCH /api/tasks/:id
 * Update a task.
 */
router.patch(
  '/:id',
  validate(updateTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.update(req.user!.userId, req.params.id, req.body);

    res.json({
      success: true,
      data: task,
    });
  }),
);

/**
 * DELETE /api/tasks/:id
 * Delete a task.
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await taskService.delete(req.user!.userId, req.params.id);

    res.status(204).send();
  }),
);

/**
 * POST /api/tasks/:id/assign/:agentId
 * Assign an agent to a task.
 */
router.post(
  '/:id/assign/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    await taskService.assignAgent(req.user!.userId, req.params.id, req.params.agentId);

    res.json({
      success: true,
      data: { message: 'Agent assigned to task' },
    });
  }),
);

/**
 * DELETE /api/tasks/:id/assign/:agentId
 * Unassign an agent from a task.
 */
router.delete(
  '/:id/assign/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    await taskService.unassignAgent(req.user!.userId, req.params.id, req.params.agentId);

    res.status(204).send();
  }),
);

export const taskRouter = router;
