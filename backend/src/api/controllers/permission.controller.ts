import { Router, Request, Response } from 'express';
import { PermissionService } from '../../core/system-integration/permission.service';
import { AuditService } from '../../core/system-integration/audit.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import {
  permissionRequestSchema,
  permissionDecisionSchema,
  paginationSchema,
} from '../validators/schemas';

const router = Router();
const permissionService = new PermissionService();
const auditService = new AuditService();

router.use(authenticate);

/**
 * POST /api/permissions/request
 * Request a new permission for an agent.
 */
router.post(
  '/request',
  validate(permissionRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const permission = await permissionService.requestPermission(req.body);

    res.status(201).json({
      success: true,
      data: permission,
    });
  }),
);

/**
 * POST /api/permissions/:id/decide
 * Approve or deny a permission request.
 */
router.post(
  '/:id/decide',
  validate(permissionDecisionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const permission = await permissionService.decide(req.params.id, req.body.granted);

    res.json({
      success: true,
      data: permission,
    });
  }),
);

/**
 * GET /api/permissions/pending
 * Get all pending permission requests for the user's agents.
 */
router.get(
  '/pending',
  asyncHandler(async (req: Request, res: Response) => {
    const permissions = await permissionService.getPendingRequests(req.user!.userId);

    res.json({
      success: true,
      data: permissions,
    });
  }),
);

/**
 * GET /api/permissions/agent/:agentId
 * Get all permissions for a specific agent.
 */
router.get(
  '/agent/:agentId',
  asyncHandler(async (req: Request, res: Response) => {
    const permissions = await permissionService.getAgentPermissions(req.params.agentId);

    res.json({
      success: true,
      data: permissions,
    });
  }),
);

/**
 * GET /api/audit
 * Get audit log for the user's agents.
 */
router.get(
  '/audit',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await auditService.getAll(req.user!.userId, { page, limit });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

export const permissionRouter = router;
