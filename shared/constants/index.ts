// ============================================================================
// Workspace AI - Shared Constants
// ============================================================================

export const SYNC_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const AGENT_MODELS = {
  MAIN: 'claude-opus-4-5-20251101',
  TEAM: 'claude-sonnet-4-5-20250929',
  BACKGROUND: 'claude-haiku-4-5-20251001',
} as const;

export const AGENT_PRESETS = {
  researcher: {
    role: 'Research Specialist',
    specialty: ['web search', 'data analysis', 'fact checking'],
    capabilities: ['web_search', 'web_fetch', 'create_file'],
  },
  developer: {
    role: 'Software Developer',
    specialty: ['coding', 'debugging', 'testing'],
    capabilities: ['bash', 'create_file', 'read_file', 'write_file'],
  },
  writer: {
    role: 'Content Writer',
    specialty: ['writing', 'editing', 'content creation'],
    capabilities: ['create_file', 'web_search'],
  },
  analyst: {
    role: 'Data Analyst',
    specialty: ['data analysis', 'visualization', 'reporting'],
    capabilities: ['read_file', 'create_file', 'web_search'],
  },
} as const;

export const MAX_MESSAGE_LENGTH = 10_000;
export const MAX_TASK_TITLE_LENGTH = 500;
export const MAX_AGENT_NAME_LENGTH = 100;
export const MAX_TEAM_NAME_LENGTH = 255;
