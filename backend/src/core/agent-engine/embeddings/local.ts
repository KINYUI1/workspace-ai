import { type EmbeddingProvider } from './index';

/**
 * Simple local embedding provider using a hashing-based approach.
 * No external API needed. Lower quality but works offline.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = 'local';
  dimensions = 256;

  async embed(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    const vector = new Float32Array(this.dimensions);

    for (const token of tokens) {
      const hash = this.hashToken(token);
      const idx = Math.abs(hash) % this.dimensions;
      vector[idx] += hash > 0 ? 1 : -1;
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return Array.from(vector);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private hashToken(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash;
  }
}
