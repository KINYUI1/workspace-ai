import { Router, Request, Response } from 'express';
import { TeamService } from '../../core/orchestration/team.service';
import { AgentService } from '../../core/agent-engine/agent.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { createTeamSchema, updateTeamSchema, paginationSchema } from '../validators/schemas';

const router = Router();
const teamService = new TeamService();
const agentService = new AgentService();

router.use(authenticate);

/**
 * POST /api/teams
 * Create a new team.
 */
router.post(
  '/',
  validate(createTeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.create(req.user!.userId, req.body);

    res.status(201).json({
      success: true,
      data: team,
    });
  }),
);

/**
 * GET /api/teams
 * List all teams for the current user.
 */
router.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await teamService.findAll(req.user!.userId, { page, limit });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

/**
 * GET /api/teams/:id
 * Get a specific team with its agents.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.findById(req.user!.userId, req.params.id);
    const agents = await agentService.findByTeam(req.user!.userId, req.params.id);

    res.json({
      success: true,
      data: { ...team, agents },
    });
  }),
);

/**
 * PATCH /api/teams/:id
 * Update a team.
 */
router.patch(
  '/:id',
  validate(updateTeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.update(req.user!.userId, req.params.id, req.body);

    res.json({
      success: true,
      data: team,
    });
  }),
);

/**
 * DELETE /api/teams/:id
 * Delete a team (agents are unassigned, not deleted).
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await teamService.delete(req.user!.userId, req.params.id);

    res.status(204).send();
  }),
);

/**
 * POST /api/teams/:id/agents/:agentId
 * Add an agent to a team.
 */
router.post(
  '/:id/agents/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    await teamService.addAgent(req.user!.userId, req.params.id, req.params.agentId);

    res.json({
      success: true,
      data: { message: 'Agent added to team' },
    });
  }),
);

/**
 * DELETE /api/teams/:id/agents/:agentId
 * Remove an agent from a team.
 */
router.delete(
  '/:id/agents/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    await teamService.removeAgent(req.user!.userId, req.params.id, req.params.agentId);

    res.status(204).send();
  }),
);

export const teamRouter = router;
