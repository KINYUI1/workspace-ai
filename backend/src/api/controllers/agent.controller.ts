import { Router, Request, Response } from 'express';
import { AgentService } from '../../core/agent-engine/agent.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { createAgentSchema, updateAgentSchema, paginationSchema } from '../validators/schemas';

const router = Router();
const agentService = new AgentService();

// All agent routes require authentication
router.use(authenticate);

/**
 * POST /api/agents
 * Create a new agent.
 */
router.post(
  '/',
  validate(createAgentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.create(req.user!.userId, req.body);

    res.status(201).json({
      success: true,
      data: agent,
    });
  }),
);

/**
 * GET /api/agents
 * List all agents for the current user.
 */
router.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await agentService.findAll(req.user!.userId, { page, limit });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

/**
 * GET /api/agents/main
 * Get the user's main agent.
 */
router.get(
  '/main',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.getMainAgent(req.user!.userId);

    res.json({
      success: true,
      data: agent,
    });
  }),
);

/**
 * GET /api/agents/:id
 * Get a specific agent by ID.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.findById(req.user!.userId, req.params.id);

    res.json({
      success: true,
      data: agent,
    });
  }),
);

/**
 * PATCH /api/agents/:id
 * Update an agent.
 */
router.patch(
  '/:id',
  validate(updateAgentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.update(req.user!.userId, req.params.id, req.body);

    res.json({
      success: true,
      data: agent,
    });
  }),
);

/**
 * DELETE /api/agents/:id
 * Delete an agent.
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await agentService.delete(req.user!.userId, req.params.id);

    res.status(204).send();
  }),
);

export const agentRouter = router;
