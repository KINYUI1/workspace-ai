import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../../config/database';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
const db = getPrismaClient();

router.use(authenticate);

const updateSettingsSchema = z.object({
  slackWebhookUrl: z.string().url().optional().or(z.literal('')),
  discordWebhookUrl: z.string().url().optional().or(z.literal('')),
  braveApiKey: z.string().optional().or(z.literal('')),
  ollamaBaseUrl: z.string().url().optional().or(z.literal('')),
  emailNotifications: z.boolean().optional(),
}).partial();

/**
 * GET /api/settings
 * Get current user settings.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await db.user.findUnique({
      where: { id: req.user!.userId },
      select: { settings: true },
    });

    res.json({
      success: true,
      data: user?.settings ?? {},
    });
  }),
);

/**
 * PATCH /api/settings
 * Update user settings (merge).
 */
router.patch(
  '/',
  validate(updateSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await db.user.findUnique({
      where: { id: req.user!.userId },
      select: { settings: true },
    });

    const currentSettings = (user?.settings as Record<string, unknown>) ?? {};
    const merged = { ...currentSettings, ...req.body };

    // Remove empty strings (treat as "clear this field")
    for (const [key, value] of Object.entries(merged)) {
      if (value === '') {
        delete merged[key];
      }
    }

    await db.user.update({
      where: { id: req.user!.userId },
      data: { settings: merged },
    });

    res.json({
      success: true,
      data: merged,
    });
  }),
);

export const settingsRouter = router;
