import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SkillService } from '../../core/system-integration/skill.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
const skillService = new SkillService();

router.use(authenticate);

const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  toolDefinition: z.record(z.unknown()),
  handlerType: z.enum(['webhook', 'builtin']),
  handlerConfig: z.record(z.unknown()),
  isPublic: z.boolean().default(false),
});

/**
 * GET /api/skills
 * List available skills (user's + global public)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const skills = await skillService.listSkills(req.user!.userId);
    res.json({ success: true, data: skills });
  }),
);

/**
 * POST /api/skills
 * Create a custom skill
 */
router.post(
  '/',
  validate(createSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const skill = await skillService.createSkill(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: skill });
  }),
);

/**
 * DELETE /api/skills/:id
 * Delete a skill
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await skillService.deleteSkill(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
);

/**
 * GET /api/skills/agent/:agentId
 * Get skills enabled for an agent
 */
router.get(
  '/agent/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    const skills = await skillService.getSkillsForAgent(req.params.agentId);
    res.json({ success: true, data: skills });
  }),
);

/**
 * POST /api/skills/agent/:agentId/:skillId
 * Enable a skill for an agent
 */
router.post(
  '/agent/:agentId/:skillId',
  asyncHandler(async (req: Request, res: Response) => {
    await skillService.enableSkill(req.params.agentId, req.params.skillId);
    res.json({ success: true });
  }),
);

/**
 * DELETE /api/skills/agent/:agentId/:skillId
 * Disable a skill for an agent
 */
router.delete(
  '/agent/:agentId/:skillId',
  asyncHandler(async (req: Request, res: Response) => {
    await skillService.disableSkill(req.params.agentId, req.params.skillId);
    res.status(204).send();
  }),
);

export const skillRouter = router;
