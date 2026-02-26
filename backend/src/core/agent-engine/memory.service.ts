import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getPrismaClient } from '../../config/database';
import { logger } from '../../utils/logger';

interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  importance: number;
  createdAt: Date;
  accessedAt: Date;
  score?: number;
}

/**
 * Agent memory with hybrid search: BM25 full-text + vector cosine similarity.
 * Falls back to FTS-only when OpenAI embeddings are unavailable.
 */
export class MemoryService {
  private readonly db: PrismaClient;
  private openai: OpenAI | null = null;

  constructor() {
    this.db = getPrismaClient();
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) return null;
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      });
      return response.data[0].embedding;
    } catch (err) {
      logger.warn('Embedding generation failed, using FTS only', { error: (err as Error).message });
      return null;
    }
  }

  async addMemory(agentId: string, content: string, type: string = 'fact', importance: number = 5): Promise<MemoryEntry> {
    const embedding = await this.getEmbedding(content);

    const memory = await this.db.agentMemory.create({
      data: {
        agentId,
        content,
        type,
        importance,
        embedding: embedding ?? undefined,
      },
    });

    logger.info('Memory stored', { agentId, memoryId: memory.id, type, hasEmbedding: !!embedding });
    return this.toEntry(memory);
  }

  async searchMemory(agentId: string, query: string, limit: number = 5): Promise<MemoryEntry[]> {
    const queryEmbedding = await this.getEmbedding(query);

    if (queryEmbedding) {
      return this.hybridSearch(agentId, query, queryEmbedding, limit);
    }

    return this.ftsSearch(agentId, query, limit);
  }

  /**
   * Hybrid search: FTS retrieves candidates, then re-rank with vector similarity + temporal decay.
   */
  private async hybridSearch(agentId: string, query: string, queryVec: number[], limit: number): Promise<MemoryEntry[]> {
    // Step 1: Get FTS candidates (broad set)
    const candidates = await this.db.$queryRaw<any[]>`
      SELECT id, content, type, importance, embedding,
        created_at as "createdAt", accessed_at as "accessedAt",
        ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS fts_score
      FROM agent_memories
      WHERE agent_id = ${agentId}::uuid
      ORDER BY importance DESC, accessed_at DESC
      LIMIT 50
    `;

    if (candidates.length === 0) return [];

    // Step 2: Compute hybrid scores in application code
    const now = Date.now();
    const scored = candidates.map((c) => {
      const ftsScore = Number(c.fts_score) || 0;

      // Cosine similarity with stored embedding
      let vecScore = 0;
      if (c.embedding && Array.isArray(c.embedding)) {
        vecScore = this.cosineSimilarity(queryVec, c.embedding as number[]);
      }

      // Temporal decay: newer memories score higher
      const ageMs = now - new Date(c.createdAt).getTime();
      const ageDays = ageMs / 86_400_000;
      const temporalScore = 1.0 / (1.0 + ageDays);

      // Importance normalized to 0-1
      const importanceScore = Number(c.importance) / 10.0;

      // Weighted hybrid score
      const score =
        ftsScore * 0.3 +
        vecScore * 0.5 +
        importanceScore * 0.1 +
        temporalScore * 0.1;

      return {
        id: c.id,
        content: c.content,
        type: c.type,
        importance: Number(c.importance),
        createdAt: c.createdAt,
        accessedAt: c.accessedAt,
        score,
        ftsScore,
        vecScore,
      };
    });

    // Step 3: Filter by minimum relevance (FTS match or good vector match)
    const relevant = scored.filter((s) => s.ftsScore > 0 || s.vecScore > 0.3);

    // Sort by hybrid score descending
    relevant.sort((a, b) => b.score - a.score);
    const results = relevant.slice(0, limit);

    // Update accessed_at
    if (results.length > 0) {
      const ids = results.map((r) => r.id);
      await this.db.agentMemory.updateMany({
        where: { id: { in: ids } },
        data: { accessedAt: new Date() },
      });
    }

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      type: r.type,
      importance: r.importance,
      createdAt: r.createdAt,
      accessedAt: r.accessedAt,
      score: r.score,
    }));
  }

  /**
   * FTS-only search fallback (original behavior).
   */
  private async ftsSearch(agentId: string, query: string, limit: number): Promise<MemoryEntry[]> {
    const memories = await this.db.$queryRaw<any[]>`
      SELECT id, content, type, importance, created_at as "createdAt", accessed_at as "accessedAt"
      FROM agent_memories
      WHERE agent_id = ${agentId}::uuid
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      ORDER BY importance DESC, accessed_at DESC
      LIMIT ${limit}
    `;

    if (memories.length > 0) {
      const ids = memories.map((m) => m.id);
      await this.db.agentMemory.updateMany({
        where: { id: { in: ids } },
        data: { accessedAt: new Date() },
      });
    }

    return memories.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      importance: Number(m.importance),
      createdAt: m.createdAt,
      accessedAt: m.accessedAt,
    }));
  }

  async getTopMemories(agentId: string, limit: number = 10): Promise<MemoryEntry[]> {
    const memories = await this.db.agentMemory.findMany({
      where: { agentId },
      orderBy: [{ importance: 'desc' }, { accessedAt: 'desc' }],
      take: limit,
    });
    return memories.map((m) => this.toEntry(m));
  }

  async getMemoryCount(agentId: string): Promise<number> {
    return this.db.agentMemory.count({ where: { agentId } });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEntry(record: any): MemoryEntry {
    return {
      id: record.id,
      content: record.content,
      type: record.type,
      importance: Number(record.importance),
      createdAt: record.createdAt,
      accessedAt: record.accessedAt,
    };
  }
}
