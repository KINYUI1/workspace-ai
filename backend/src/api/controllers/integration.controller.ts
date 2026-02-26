import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { IntegrationService } from '../../core/system-integration/integration.service';
import { IntegrationExecutorService } from '../../core/system-integration/integration-executor.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { env } from '../../config/env';

const router = Router();
const integrationService = new IntegrationService();
const executorService = new IntegrationExecutorService();

const connectSchema = z.object({
  integrationId: z.string().uuid(),
  credentials: z.record(z.unknown()).default({}),
  config: z.record(z.unknown()).optional(),
});

const updateConfigSchema = z.object({
  config: z.record(z.unknown()),
});

const executeActionSchema = z.object({
  action: z.string().min(1),
  input: z.record(z.unknown()).default({}),
});

// --- OAuth callback (no auth middleware — browser redirect) ---
router.get(
  '/oauth/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      const html = oauthResultPage(false, `Authorization denied: ${error}`);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    if (!code || !state) {
      const html = oauthResultPage(false, 'Missing authorization code or state');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    const result = await executorService.handleOAuthCallback(code as string, state as string);

    const html = oauthResultPage(
      result.success,
      result.success
        ? `${result.integrationName} connected successfully!`
        : result.error || 'Connection failed',
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }),
);

// --- All routes below require authentication ---
router.use(authenticate);

// List all available integrations (catalog)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const integrations = await integrationService.listIntegrations(category);
    res.json({ success: true, data: integrations });
  }),
);

// Get user's connected integrations (must be before /:id)
router.get(
  '/user/connections',
  asyncHandler(async (req: Request, res: Response) => {
    const connections = await integrationService.getUserConnections(req.user!.userId);
    res.json({ success: true, data: connections });
  }),
);

// Get OAuth authorization URL for an integration
router.get(
  '/oauth/authorize/:integrationSlug',
  asyncHandler(async (req: Request, res: Response) => {
    const url = executorService.getAuthorizationUrl(req.user!.userId, req.params.integrationSlug);
    if (!url) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'OAuth is not configured for this integration. Use API key connection instead.',
        },
      });
      return;
    }
    res.json({ success: true, data: { authorizationUrl: url } });
  }),
);

// Execute an action on a connected integration
router.post(
  '/execute/:integrationId',
  validate(executeActionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await executorService.executeAction(
      req.user!.userId,
      req.params.integrationId,
      req.body.action,
      req.body.input,
    );
    res.json({ success: true, data: result });
  }),
);

// Test if a connection is still valid
router.post(
  '/test/:integrationId',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await executorService.testConnection(req.user!.userId, req.params.integrationId);
    res.json({ success: true, data: result });
  }),
);

// Get a single integration details
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const integration = await integrationService.getIntegration(req.params.id);
    res.json({ success: true, data: integration });
  }),
);

// Connect an integration (API key / manual credentials)
router.post(
  '/connect',
  validate(connectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const connection = await integrationService.connectIntegration(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: connection });
  }),
);

// Disconnect an integration
router.post(
  '/disconnect/:integrationId',
  asyncHandler(async (req: Request, res: Response) => {
    await integrationService.disconnectIntegration(req.user!.userId, req.params.integrationId);
    res.json({ success: true });
  }),
);

// Update connection config
router.patch(
  '/connections/:integrationId/config',
  validate(updateConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await integrationService.updateConnectionConfig(
      req.user!.userId,
      req.params.integrationId,
      req.body.config,
    );
    res.json({ success: true, data: updated });
  }),
);

// Get logs for a connection
router.get(
  '/connections/:integrationId/logs',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await integrationService.getConnectionLogs(
      req.user!.userId,
      req.params.integrationId,
      limit,
    );
    res.json({ success: true, data: logs });
  }),
);

// --- Helper ---

function oauthResultPage(success: boolean, message: string): string {
  const frontendUrl = env.CORS_ORIGIN || 'http://localhost:3001';
  return `<!DOCTYPE html>
<html>
<head><title>Integration ${success ? 'Connected' : 'Error'}</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f1117;color:#e1e4e8;">
  <div style="text-align:center;max-width:400px;padding:2rem;">
    <div style="font-size:3rem;margin-bottom:1rem;">${success ? '&#9989;' : '&#10060;'}</div>
    <h2 style="margin:0 0 0.5rem">${success ? 'Connected!' : 'Connection Failed'}</h2>
    <p style="color:#8b949e;margin:0 0 1.5rem">${message}</p>
    <p style="color:#8b949e;font-size:0.875rem">You can close this window.</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'oauth-callback', success: ${success} }, '${frontendUrl}');
        setTimeout(() => window.close(), 2000);
      }
    </script>
  </div>
</body>
</html>`;
}

export const integrationRouter = router;
