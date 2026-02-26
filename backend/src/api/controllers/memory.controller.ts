import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';
import { getEmbeddingProvider } from '../../core/agent-engine/embeddings';

const router = Router();

// In-memory document storage (would use DB + vector index in production)
interface MemoryDoc {
  id: string;
  name: string;
  type: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  indexedAt: string;
  size: number;
  userId: string;
}

const documents: MemoryDoc[] = [];

/**
 * GET /api/memory/documents
 */
router.get(
  '/documents',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userDocs = documents
      .filter((d) => d.userId === req.user!.userId)
      .map(({ content, chunks, userId, ...rest }) => rest);
    res.json({ data: userDocs });
  }),
);

/**
 * GET /api/memory/stats
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userDocs = documents.filter((d) => d.userId === req.user!.userId);
    const totalChunks = userDocs.reduce((sum, d) => sum + d.chunkCount, 0);

    let providerName = 'local';
    try {
      const provider = await getEmbeddingProvider();
      providerName = provider.name;
    } catch {
      // fallback
    }

    res.json({
      data: {
        totalDocuments: userDocs.length,
        totalChunks,
        embeddingProvider: providerName,
        lastSyncAt: userDocs.length > 0 ? userDocs[userDocs.length - 1].indexedAt : null,
      },
    });
  }),
);

/**
 * POST /api/memory/search
 */
router.post(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const queryLower = query.toLowerCase();
    const results: Array<{ content: string; score: number; source: string }> = [];

    for (const doc of documents.filter((d) => d.userId === req.user!.userId)) {
      for (const chunk of doc.chunks) {
        const words = queryLower.split(/\s+/);
        const chunkLower = chunk.toLowerCase();
        const matchCount = words.filter((w: string) => chunkLower.includes(w)).length;
        const score = matchCount / words.length;

        if (score > 0.3) {
          results.push({ content: chunk, score, source: doc.name });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ data: results.slice(0, 10) });
  }),
);

/**
 * POST /api/memory/documents
 * Index a document.
 */
router.post(
  '/documents',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, content } = req.body;
    if (!name || !content) {
      res.status(400).json({ error: 'name and content are required' });
      return;
    }

    // Chunk by paragraphs
    const chunks = content
      .split(/\n\n+/)
      .map((c: string) => c.trim())
      .filter((c: string) => c.length > 20);

    const doc: MemoryDoc = {
      id: crypto.randomUUID(),
      name,
      type: name.split('.').pop() || 'txt',
      content,
      chunks,
      chunkCount: chunks.length,
      indexedAt: new Date().toISOString(),
      size: Buffer.byteLength(content, 'utf-8'),
      userId: req.user!.userId,
    };

    documents.push(doc);
    const { content: _, chunks: __, userId, ...rest } = doc;
    res.status(201).json({ data: rest });
  }),
);

/**
 * DELETE /api/memory/documents/:id
 */
router.delete(
  '/documents/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const idx = documents.findIndex(
      (d) => d.id === req.params.id && d.userId === req.user!.userId,
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    documents.splice(idx, 1);
    res.json({ ok: true });
  }),
);

export { router as memoryRouter };
