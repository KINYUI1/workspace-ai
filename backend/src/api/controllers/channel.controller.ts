import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';
import { channelManager } from '../../core/channels/channel-manager';
import { channelRegistry } from '../../core/channels/channel-registry';

const router = Router();

/**
 * GET /api/channels
 * List all connected channels.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const channels = channelManager.getChannelStatuses();
    res.json({ data: channels });
  }),
);

/**
 * GET /api/channels/catalog
 * List available channel adapters.
 */
router.get(
  '/catalog',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const adapters = channelRegistry.getAvailableAdapters().map((a) => ({
      type: a.type,
      displayName: a.displayName,
      description: a.description,
      icon: a.icon,
      configSchema: a.configSchema,
    }));
    res.json({ data: adapters });
  }),
);

/**
 * POST /api/channels
 * Connect a new channel.
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, name, config } = req.body;

    if (!type || !name) {
      res.status(400).json({ error: 'type and name are required' });
      return;
    }

    const id = crypto.randomUUID();
    const channelConfig = { id, type, name, enabled: true, config: config || {} };

    try {
      const channel = channelRegistry.createChannel(channelConfig);
      await channelManager.addChannel(channel);
      await channelManager.connectChannel(id);
      res.status(201).json({ data: { id, type, name, status: 'connected' } });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  }),
);

/**
 * DELETE /api/channels/:id
 * Disconnect a channel.
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await channelManager.disconnectChannel(req.params.id);
    res.json({ ok: true });
  }),
);

/**
 * GET /api/channels/:id/status
 * Check channel health.
 */
router.get(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const channel = channelManager.getChannel(req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ data: channel.getStatus() });
  }),
);

export { router as channelRouter };
