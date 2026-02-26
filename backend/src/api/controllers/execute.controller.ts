import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SandboxService } from '../../core/system-integration/sandbox.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logger } from '../../utils/logger';

const router = Router();
const sandboxService = new SandboxService();

const executeSchema = z.object({
  language: z.enum(['python', 'javascript', 'bash']),
  code: z.string().min(1).max(50000),
});

router.use(authenticate);

router.post(
  '/',
  validate(executeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { language, code } = req.body as { language: 'python' | 'javascript' | 'bash'; code: string };

    const dockerAvailable = await sandboxService.isDockerAvailable();
    if (!dockerAvailable) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DOCKER_UNAVAILABLE',
          message: 'Docker is not running. Start Docker Desktop to execute code.',
        },
      });
      return;
    }

    logger.info('Code execution requested', { userId: req.user!.userId, language });

    const result = await sandboxService.executeCode(language, code, 30000);

    res.json({ success: true, data: result });
  }),
);

export const executeRouter = router;
