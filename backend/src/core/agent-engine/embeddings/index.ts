import { logger } from '../../../utils/logger';

export interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

let activeProvider: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (activeProvider) return activeProvider;

  // Try providers in order of preference
  if (process.env.OPENAI_API_KEY) {
    try {
      const { OpenAIEmbeddingProvider } = await import('./openai');
      activeProvider = new OpenAIEmbeddingProvider();
      logger.info('Using OpenAI embedding provider');
      return activeProvider;
    } catch {
      // fallback
    }
  }

  if (process.env.OLLAMA_BASE_URL) {
    try {
      const { OllamaEmbeddingProvider } = await import('./ollama');
      activeProvider = new OllamaEmbeddingProvider();
      logger.info('Using Ollama embedding provider');
      return activeProvider;
    } catch {
      // fallback
    }
  }

  // Fallback: local bag-of-words
  const { LocalEmbeddingProvider } = await import('./local');
  activeProvider = new LocalEmbeddingProvider();
  logger.info('Using local embedding provider (no API needed)');
  return activeProvider;
}

export function resetProvider(): void {
  activeProvider = null;
}
