import { Router, Request, Response } from 'express';
import { OrganizationService } from '../../core/orchestration/organization.service';
import { DepartmentService } from '../../core/orchestration/department.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { paginationSchema } from '../validators/schemas';
import { z } from 'zod';

const router = Router();
const orgService = new OrganizationService();
const deptService = new DepartmentService();

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

const createDeptSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const updateDeptSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

const moveDeptSchema = z.object({
  targetOrganizationId: z.string().uuid(),
});

router.use(authenticate);

// --- Organizations ---

router.post(
  '/',
  validate(createOrgSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await orgService.create(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: org });
  }),
);

router.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await orgService.findAll(req.user!.userId, { page, limit });
    res.json({ success: true, data: result.data, meta: result.meta });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const org = await orgService.findById(req.user!.userId, req.params.id);
    res.json({ success: true, data: org });
  }),
);

router.patch(
  '/:id',
  validate(updateOrgSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await orgService.update(req.user!.userId, req.params.id, req.body);
    res.json({ success: true, data: org });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await orgService.delete(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
);

// --- Departments (nested under organization) ---

router.post(
  '/:orgId/departments',
  validate(createDeptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dept = await deptService.create(req.user!.userId, req.params.orgId, req.body);
    res.status(201).json({ success: true, data: dept });
  }),
);

router.get(
  '/:orgId/departments',
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await deptService.findAll(req.params.orgId, { page, limit });
    res.json({ success: true, data: result.data, meta: result.meta });
  }),
);

router.get(
  '/:orgId/departments/:deptId',
  asyncHandler(async (req: Request, res: Response) => {
    const dept = await deptService.findById(req.params.orgId, req.params.deptId);
    res.json({ success: true, data: dept });
  }),
);

router.patch(
  '/:orgId/departments/:deptId',
  validate(updateDeptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dept = await deptService.update(req.params.orgId, req.params.deptId, req.body);
    res.json({ success: true, data: dept });
  }),
);

router.patch(
  '/:orgId/departments/:deptId/move',
  validate(moveDeptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dept = await deptService.moveDepartment(
      req.user!.userId,
      req.params.deptId,
      req.body.targetOrganizationId,
    );
    res.json({ success: true, data: dept });
  }),
);

router.delete(
  '/:orgId/departments/:deptId',
  asyncHandler(async (req: Request, res: Response) => {
    await deptService.delete(req.params.orgId, req.params.deptId);
    res.status(204).send();
  }),
);

// Assign team to department
router.post(
  '/:orgId/departments/:deptId/teams/:teamId',
  asyncHandler(async (req: Request, res: Response) => {
    await deptService.addTeam(req.params.orgId, req.params.deptId, req.params.teamId);
    res.json({ success: true, data: { message: 'Team assigned to department' } });
  }),
);

// Remove team from department
router.delete(
  '/:orgId/departments/:deptId/teams/:teamId',
  asyncHandler(async (req: Request, res: Response) => {
    await deptService.removeTeam(req.params.orgId, req.params.deptId, req.params.teamId);
    res.status(204).send();
  }),
);

export const organizationRouter = router;
