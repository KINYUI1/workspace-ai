import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import { FileService } from '../../core/system-integration/file.service';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
const fileService = new FileService();

const createFileSchema = z.object({
  path: z.string().min(1).max(1000),
  content: z.string(),
  language: z.string().max(50).optional(),
});

router.use(authenticate);

router.post(
  '/',
  validate(createFileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const file = await fileService.createFile(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: file });
  }),
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const prefix = req.query.prefix as string | undefined;
    const result = await fileService.listFiles(req.user!.userId, prefix);
    res.json({ success: true, data: result.data });
  }),
);

router.get(
  '/tree',
  asyncHandler(async (req: Request, res: Response) => {
    const tree = await fileService.getFileTree(req.user!.userId);
    res.json({ success: true, data: tree });
  }),
);

router.get(
  '/by-path',
  asyncHandler(async (req: Request, res: Response) => {
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ success: false, error: { message: 'path query param required' } });
      return;
    }
    const file = await fileService.getFile(req.user!.userId, path);
    res.json({ success: true, data: file });
  }),
);

router.get(
  '/download',
  asyncHandler(async (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ success: false, error: { message: 'path query param required' } });
      return;
    }
    const file = await fileService.getFile(req.user!.userId, filePath);
    const fileName = filePath.split('/').pop() || 'file';
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(file.content);
  }),
);

router.get(
  '/download-dir',
  asyncHandler(async (req: Request, res: Response) => {
    const prefix = req.query.prefix as string;
    if (!prefix) {
      res.status(400).json({ success: false, error: { message: 'prefix query param required' } });
      return;
    }
    const result = await fileService.listFilesWithContent(req.user!.userId, prefix);
    if (result.length === 0) {
      res.status(404).json({ success: false, error: { message: 'No files found in directory' } });
      return;
    }

    const dirName = prefix.replace(/\/$/, '').split('/').pop() || 'files';
    res.setHeader('Content-Disposition', `attachment; filename="${dirName}.zip"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const file of result) {
      // Strip the prefix so paths inside the zip are relative
      const relativePath = file.path.startsWith(prefix)
        ? file.path.slice(prefix.length)
        : file.path;
      archive.append(file.content, { name: relativePath || file.path });
    }

    await archive.finalize();
  }),
);

router.delete(
  '/by-path',
  asyncHandler(async (req: Request, res: Response) => {
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ success: false, error: { message: 'path query param required' } });
      return;
    }
    await fileService.deleteFile(req.user!.userId, path);
    res.status(204).send();
  }),
);

export const fileRouter = router;
