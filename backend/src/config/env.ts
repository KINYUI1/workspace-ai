import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// ---------------------------------------------------------------------------
// Desktop mode flag — set by the Electron main process before importing.
// ---------------------------------------------------------------------------
export const DESKTOP_MODE = process.env.WORKSPACE_AI_DESKTOP === 'true';

// Load .env from project root (only in web/server mode)
if (!DESKTOP_MODE) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

// ---------------------------------------------------------------------------
// In desktop mode the Anthropic key and DATABASE_URL may not be set yet
// (the user hasn't configured them). We use more lenient validation.
// ---------------------------------------------------------------------------

const baseSchema = {
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Agent config
  MAX_AGENTS_PER_USER: z.coerce.number().default(100),
  SYNC_INTERVAL_MINUTES: z.coerce.number().default(20),
  DEFAULT_AGENT_MODEL: z.string().default('claude-sonnet-4-5-20250929'),
  MAIN_AGENT_MODEL: z.string().default('claude-opus-4-6'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // OpenAI (embeddings, TTS)
  OPENAI_API_KEY: z.string().optional(),

  // Web search
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  // Local models
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),

  // OAuth integrations (all optional — features degrade gracefully)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_BASE_URL: z.string().default('http://localhost:3000'),
};

// Desktop mode: Anthropic key is optional (user may use Ollama instead)
const desktopSchema = z.object({
  ...baseSchema,
  ANTHROPIC_API_KEY: z.string().default(''),
});

// Web mode: Anthropic key is required
const webSchema = z.object({
  ...baseSchema,
  ANTHROPIC_API_KEY: z.string().min(1),
});

const envSchema = DESKTOP_MODE ? desktopSchema : webSchema;

export type Env = z.infer<typeof webSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${errors?.join(', ')}`)
      .join('\n');

    throw new Error(`Invalid environment variables:\n${missing}`);
  }

  return parsed.data as Env;
}

export const env = loadEnv();
