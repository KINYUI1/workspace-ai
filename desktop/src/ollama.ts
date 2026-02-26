import { loadConfig } from './config';

// ---------------------------------------------------------------------------
// Ollama Helper — checks availability and lists models
// ---------------------------------------------------------------------------

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

/**
 * Check if Ollama is running at the configured base URL.
 */
export async function isOllamaRunning(): Promise<boolean> {
  const config = loadConfig();
  try {
    const res = await fetch(`${config.llm.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List available Ollama models.
 */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  const config = loadConfig();
  try {
    const res = await fetch(`${config.llm.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: OllamaModel[] };
    return data.models ?? [];
  } catch {
    return [];
  }
}

/**
 * Pull a model from the Ollama registry.
 * Returns a readable stream of progress events.
 */
export async function pullOllamaModel(
  modelName: string,
): Promise<ReadableStream<Uint8Array> | null> {
  const config = loadConfig();
  try {
    const res = await fetch(`${config.llm.ollamaBaseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    return res.body;
  } catch {
    return null;
  }
}
