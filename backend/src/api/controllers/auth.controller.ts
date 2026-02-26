import { Router, Request, Response } from 'express';
import { AuthService } from '../../core/agent-engine/auth.service';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { registerSchema, loginSchema } from '../validators/schemas';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name);

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * POST /api/auth/login
 * Authenticate and receive a JWT token.
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.json({
      success: true,
      data: result,
    });
  }),
);

/**
 * GET /api/auth/me
 * Get the current user's profile.
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await authService.getProfile(req.user!.userId);

    res.json({
      success: true,
      data: profile,
    });
  }),
);

/**
 * GET /api/auth/desktop-token
 * Desktop mode only: get an auto-generated token for the local user.
 */
router.get(
  '/desktop-token',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await authService.getDesktopToken();
    res.json({
      success: true,
      data: result,
    });
  }),
);

export const authRouter = router;
