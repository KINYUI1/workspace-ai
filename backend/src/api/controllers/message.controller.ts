import { Router, Request, Response } from 'express';
import { MessageService } from '../../core/communication/message.service';
import { ChatService } from '../../core/communication/chat.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { sendMessageSchema, paginationSchema } from '../validators/schemas';
import { getPrismaClient } from '../../config/database';

const router = Router();
const messageService = new MessageService();
const chatService = new ChatService();

// Usage limit: 6 prompts per 24 hours (resets rolling)
const DAILY_PROMPT_LIMIT = 6;
const UNLIMITED_EMAIL = 'ndiclementkinyui@gmail.com';

async function getUsageInfo(userId: string) {
  const prisma = getPrismaClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const isUnlimited = user?.email === UNLIMITED_EMAIL;

  const used = await prisma.message.count({
    where: { fromUser: true, createdAt: { gte: since } },
  });

  return { used, limit: DAILY_PROMPT_LIMIT, remaining: Math.max(0, DAILY_PROMPT_LIMIT - used), isUnlimited };
}

router.use(authenticate);

/**
 * GET /api/messages/usage-limit
 * Returns current prompt usage and limit info.
 */
router.get(
  '/usage-limit',
  asyncHandler(async (req: Request, res: Response) => {
    const info = await getUsageInfo(req.user!.userId);
    res.json({
      success: true,
      data: {
        used: info.used,
        limit: info.isUnlimited ? null : info.limit,
        remaining: info.isUnlimited ? null : info.remaining,
        unlimited: info.isUnlimited,
        resetsIn: '24 hours (rolling)',
      },
    });
  }),
);

/**
 * POST /api/messages
 * Send a message from the user to one or more agents.
 * After persisting, triggers the AI reply loop for the main agent.
 */
router.post(
  '/',
  validate(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Check usage limit
    const usage = await getUsageInfo(userId);
    if (!usage.isUnlimited && usage.remaining <= 0) {
      res.status(429).json({
        success: false,
        error: {
          code: 'USAGE_LIMIT_REACHED',
          message: `You've reached your daily limit of ${DAILY_PROMPT_LIMIT} prompts. Your limit resets on a rolling 24-hour basis.`,
          used: usage.used,
          limit: usage.limit,
        },
      });
      return;
    }

    // handleUserMessage saves the message AND triggers the AI reply via WebSocket
    await chatService.handleUserMessage(req.body, userId);

    res.status(201).json({
      success: true,
      data: {
        message: 'Message sent. Agent reply will arrive via WebSocket.',
        usage: usage.isUnlimited ? undefined : { used: usage.used + 1, limit: usage.limit, remaining: usage.remaining - 1 },
      },
    });
  }),
);

/**
 * GET /api/messages/agent/:agentId
 * Get message history for a specific agent.
 */
router.get(
  '/agent/:agentId',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await messageService.getAgentMessages(req.params.agentId, { page, limit });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

/**
 * GET /api/messages/team/:teamId
 * Get message history for a team channel.
 */
router.get(
  '/team/:teamId',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await messageService.getTeamMessages(req.params.teamId, { page, limit });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

/**
 * POST /api/messages/:id/read/:agentId
 * Mark a message as read by an agent.
 */
router.post(
  '/:id/read/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    await messageService.markAsRead(req.params.id, req.params.agentId);

    res.json({
      success: true,
      data: { message: 'Message marked as read' },
    });
  }),
);

export const messageRouter = router;
