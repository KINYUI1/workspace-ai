import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';
import { SessionService } from '../../core/communication/session.service';

const router = Router();
const sessionService = new SessionService();

/**
 * GET /api/sessions
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const sessions = await sessionService.listSessions(req.user!.userId);
    res.json({ data: sessions });
  }),
);

/**
 * POST /api/sessions
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, agentId } = req.body;
    const session = await sessionService.createSession(req.user!.userId, name, agentId);
    res.status(201).json({ data: session });
  }),
);

/**
 * PATCH /api/sessions/:id
 */
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const session = await sessionService.renameSession(req.params.id, req.user!.userId, name);
    res.json({ data: session });
  }),
);

/**
 * DELETE /api/sessions/:id
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await sessionService.deleteSession(req.params.id, req.user!.userId);
    res.json({ ok: true });
  }),
);

export { router as sessionRouter };
