import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';
import { getPrismaClient } from '../../config/database';

const router = Router();

const ADMIN_EMAIL = 'ndiclementkinyui@gmail.com';

async function isAdmin(userId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email === ADMIN_EMAIL;
}

// ============================================================================
// Admin-only endpoints (all feedback from all users)
// ============================================================================

/**
 * GET /api/feedback/admin/all
 * List ALL feedback from ALL users (admin only).
 */
router.get(
  '/admin/all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isAdmin(req.user!.userId))) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const prisma = getPrismaClient();
    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 500,
    });
    res.json({ data: feedback });
  }),
);

/**
 * GET /api/feedback/admin/stats
 * Aggregate stats across ALL users (admin only).
 */
router.get(
  '/admin/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isAdmin(req.user!.userId))) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const prisma = getPrismaClient();
    const all = await prisma.feedback.findMany({
      select: { type: true, status: true, userId: true },
    });

    const total = all.length;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const entry of all) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      uniqueUsers.add(entry.userId);
    }

    res.json({ data: { total, byType, byStatus, uniqueUsers: uniqueUsers.size } });
  }),
);

/**
 * PATCH /api/feedback/admin/:id
 * Update any feedback status (admin only, no ownership check).
 */
router.patch(
  '/admin/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isAdmin(req.user!.userId))) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const prisma = getPrismaClient();
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feedback not found' } });
      return;
    }

    const { status } = req.body;
    const validStatuses = ['new', 'reviewed', 'resolved'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${validStatuses.join(', ')}` } });
      return;
    }

    const updated = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ data: updated });
  }),
);

/**
 * DELETE /api/feedback/admin/:id
 * Delete any feedback entry (admin only).
 */
router.delete(
  '/admin/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isAdmin(req.user!.userId))) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const prisma = getPrismaClient();
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feedback not found' } });
      return;
    }

    await prisma.feedback.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ============================================================================
// Regular user endpoints
// ============================================================================

/**
 * GET /api/feedback
 * List feedback for the current user (newest first).
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const feedback = await prisma.feedback.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data: feedback });
  }),
);

/**
 * GET /api/feedback/stats
 * Aggregate counts by type and status.
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const all = await prisma.feedback.findMany({
      where: { userId: req.user!.userId },
      select: { type: true, status: true },
    });

    const total = all.length;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const entry of all) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    }

    res.json({ data: { total, byType, byStatus } });
  }),
);

/**
 * POST /api/feedback
 * Create a new feedback entry.
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, rating, message, metadata } = req.body;

    if (!type || !message) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'type and message are required' } });
      return;
    }

    const validTypes = ['bug', 'feature', 'improvement', 'general'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `type must be one of: ${validTypes.join(', ')}` } });
      return;
    }

    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'rating must be between 1 and 5' } });
      return;
    }

    const prisma = getPrismaClient();
    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user!.userId,
        type,
        rating: rating ?? null,
        message,
        metadata: metadata ?? {},
      },
    });

    res.status(201).json({ data: feedback });
  }),
);

/**
 * PATCH /api/feedback/:id
 * Update feedback status.
 */
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const existing = await prisma.feedback.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feedback not found' } });
      return;
    }

    const { status } = req.body;
    const validStatuses = ['new', 'reviewed', 'resolved'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${validStatuses.join(', ')}` } });
      return;
    }

    const updated = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ data: updated });
  }),
);

/**
 * DELETE /api/feedback/:id
 * Delete a feedback entry.
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const existing = await prisma.feedback.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feedback not found' } });
      return;
    }

    await prisma.feedback.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

export { router as feedbackRouter };
