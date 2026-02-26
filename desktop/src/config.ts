import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Desktop Configuration Manager
// Reads/writes ~/.workspace-ai/config.json — replaces .env for desktop mode.
// ---------------------------------------------------------------------------

export interface DesktopConfig {
  server: {
    port: number;
  };
  llm: {
    provider: 'anthropic' | 'openai' | 'ollama';
    anthropicApiKey?: string;
    openaiApiKey?: string;
    ollamaBaseUrl: string;
    defaultModel?: string;
  };
  integrations: {
    braveApiKey?: string;
    githubToken?: string;
  };
  appearance: {
    startMinimized: boolean;
    launchOnLogin: boolean;
  };
  internal: {
    jwtSecret: string;
    defaultUserEmail: string;
    defaultUserName: string;
  };
}

const DATA_DIR = path.join(os.homedir(), '.workspace-ai');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const DB_PATH = path.join(DATA_DIR, 'workspace-ai.db');
const SANDBOX_DIR = path.join(DATA_DIR, 'sandbox');

const DEFAULT_CONFIG: DesktopConfig = {
  server: { port: 3333 },
  llm: {
    provider: 'anthropic',
    ollamaBaseUrl: 'http://localhost:11434',
  },
  integrations: {},
  appearance: {
    startMinimized: false,
    launchOnLogin: false,
  },
  internal: {
    jwtSecret: crypto.randomBytes(48).toString('hex'),
    defaultUserEmail: 'local@workspace-ai.local',
    defaultUserName: 'Local User',
  },
};

let _config: DesktopConfig | null = null;

/**
 * Ensure the data directory and sub-directories exist.
 */
export function ensureDataDir(): void {
  for (const dir of [DATA_DIR, SANDBOX_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Load config from disk, merging with defaults.
 * Creates a new config file with defaults if none exists.
 */
export function loadConfig(): DesktopConfig {
  ensureDataDir();

  if (_config) return _config;

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const saved = JSON.parse(raw) as Partial<DesktopConfig>;
      // Deep merge saved over defaults
      _config = {
        server: { ...DEFAULT_CONFIG.server, ...saved.server },
        llm: { ...DEFAULT_CONFIG.llm, ...saved.llm },
        integrations: { ...DEFAULT_CONFIG.integrations, ...saved.integrations },
        appearance: { ...DEFAULT_CONFIG.appearance, ...saved.appearance },
        internal: { ...DEFAULT_CONFIG.internal, ...saved.internal },
      };
    } catch {
      _config = { ...DEFAULT_CONFIG };
    }
  } else {
    _config = { ...DEFAULT_CONFIG };
    saveConfig(_config);
  }

  return _config;
}

/**
 * Save current config to disk.
 */
export function saveConfig(config: DesktopConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  _config = config;
}

/**
 * Update a subset of the config and persist.
 */
export function updateConfig(patch: Partial<DesktopConfig>): DesktopConfig {
  const current = loadConfig();
  const updated: DesktopConfig = {
    server: { ...current.server, ...patch.server },
    llm: { ...current.llm, ...patch.llm },
    integrations: { ...current.integrations, ...patch.integrations },
    appearance: { ...current.appearance, ...patch.appearance },
    internal: { ...current.internal, ...patch.internal },
  };
  saveConfig(updated);
  return updated;
}

/**
 * Check if this is the very first launch (no config file on disk).
 */
export function isFirstRun(): boolean {
  return !fs.existsSync(CONFIG_PATH);
}

/**
 * Get the absolute path to the SQLite database file.
 */
export function getDatabasePath(): string {
  return DB_PATH;
}

/**
 * Get the data directory path.
 */
export function getDataDir(): string {
  return DATA_DIR;
}

/**
 * Get the sandbox directory path for code execution.
 */
export function getSandboxDir(): string {
  return SANDBOX_DIR;
}

/**
 * Set environment variables that the backend expects,
 * sourced from the desktop config instead of .env.
 */
export function injectEnvFromConfig(): void {
  const config = loadConfig();

  process.env.WORKSPACE_AI_DESKTOP = 'true';
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.PORT = String(config.server.port);
  process.env.DATABASE_URL = `file:${DB_PATH}`;
  process.env.JWT_SECRET = config.internal.jwtSecret;
  process.env.JWT_EXPIRES_IN = '365d';
  process.env.CORS_ORIGIN = `http://localhost:${config.server.port}`;
  process.env.OLLAMA_BASE_URL = config.llm.ollamaBaseUrl;

  // Redis not needed in desktop mode — set a dummy to avoid startup crash
  process.env.REDIS_URL = 'redis://localhost:6379';

  if (config.llm.anthropicApiKey) {
    process.env.ANTHROPIC_API_KEY = config.llm.anthropicApiKey;
  }
  if (config.llm.openaiApiKey) {
    process.env.OPENAI_API_KEY = config.llm.openaiApiKey;
  }
  if (config.integrations.braveApiKey) {
    process.env.BRAVE_SEARCH_API_KEY = config.integrations.braveApiKey;
  }
}
