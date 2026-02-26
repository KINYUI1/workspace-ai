import { z } from 'zod';
import {
  MAX_AGENT_NAME_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TASK_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
} from '../../../../shared/constants';

// --- Auth --------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(255),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- Agents ------------------------------------------------------------------

export const createAgentSchema = z.object({
  name: z.string().min(1).max(MAX_AGENT_NAME_LENGTH),
  role: z.string().min(1).max(100),
  specialty: z.array(z.string()).default([]),
  teamId: z.string().uuid().optional(),
  capabilities: z.array(z.string()).default([]),
  isMainAgent: z.boolean().default(false),
  personality: z.string().max(2000).optional(),
  modelProvider: z.enum(['anthropic', 'ollama']).default('anthropic'),
  modelName: z.string().max(100).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(MAX_AGENT_NAME_LENGTH).optional(),
  role: z.string().min(1).max(100).optional(),
  specialty: z.array(z.string()).optional(),
  teamId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'idle', 'busy', 'error', 'offline']).optional(),
  capabilities: z.array(z.string()).optional(),
  personality: z.string().max(2000).nullable().optional(),
  modelProvider: z.enum(['anthropic', 'ollama']).optional(),
  modelName: z.string().max(100).nullable().optional(),
});

// --- Teams -------------------------------------------------------------------

export const createTeamSchema = z.object({
  name: z.string().min(1).max(MAX_TEAM_NAME_LENGTH),
  description: z.string().max(2000).default(''),
  goal: z.string().max(2000).default(''),
  leadAgentId: z.string().uuid().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(MAX_TEAM_NAME_LENGTH).optional(),
  description: z.string().max(2000).optional(),
  goal: z.string().max(2000).optional(),
  leadAgentId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  sharedContext: z.string().optional(),
});

// --- Tasks -------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().min(1).max(MAX_TASK_TITLE_LENGTH),
  description: z.string().max(5000).default(''),
  teamId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  deadline: z.string().datetime().optional(),
  assignTo: z.array(z.string().uuid()).default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(MAX_TASK_TITLE_LENGTH).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['pending', 'in_progress', 'blocked', 'completed', 'failed']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  deadline: z.string().datetime().nullable().optional(),
  result: z.record(z.unknown()).optional(),
});

// --- Messages ----------------------------------------------------------------

export const sendMessageSchema = z.object({
  to: z.array(z.string().uuid()).min(1),
  type: z.enum(['direct', 'team', 'broadcast', 'system']).default('direct'),
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  metadata: z
    .object({
      taskId: z.string().uuid().optional(),
      priority: z.number().int().min(0).max(10).optional(),
      requiresResponse: z.boolean().optional(),
    })
    .default({}),
});

// --- Permissions -------------------------------------------------------------

export const permissionRequestSchema = z.object({
  agentId: z.string().uuid(),
  permissionType: z.enum([
    'read_files',
    'write_files',
    'execute_shell',
    'install_software',
    'launch_apps',
    'network_access',
  ]),
  scope: z.string().max(1000),
  duration: z.enum(['once', 'session', 'permanent']).default('once'),
});

export const permissionDecisionSchema = z.object({
  granted: z.boolean(),
});

// --- Query Params ------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).passthrough();
