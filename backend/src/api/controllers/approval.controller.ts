import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';
import { respondToApproval, getPendingApproval } from '../../core/agent-engine/approval.service';

const router = Router();

/**
 * POST /api/approvals/:id/respond
 * Accept or reject an approval request.
 */
router.post(
  '/:id/respond',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { decision, alwaysAllow } = req.body;

    if (!decision || !['approved', 'denied'].includes(decision)) {
      res.status(400).json({ error: 'decision must be "approved" or "denied"' });
      return;
    }

    const pending = getPendingApproval(id);
    if (!pending) {
      res.status(404).json({ error: 'Approval request not found or already resolved' });
      return;
    }

    // Verify the approval belongs to the requesting user
    if (pending.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const success = respondToApproval(id, decision, alwaysAllow === true);
    if (!success) {
      res.status(409).json({ error: 'Approval already resolved' });
      return;
    }

    res.json({ ok: true, decision });
  }),
);

export { router as approvalRouter };
