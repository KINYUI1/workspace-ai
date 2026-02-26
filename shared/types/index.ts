// ============================================================================
// Workspace AI - Shared Type Definitions
// ============================================================================

// --- Enums -------------------------------------------------------------------

export const AgentStatus = {
  ACTIVE: 'active',
  IDLE: 'idle',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline',
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const TeamStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
} as const;
export type TeamStatus = (typeof TeamStatus)[keyof typeof TeamStatus];

export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const MessageType = {
  DIRECT: 'direct',
  TEAM: 'team',
  BROADCAST: 'broadcast',
  SYSTEM: 'system',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const PermissionType = {
  READ_FILES: 'read_files',
  WRITE_FILES: 'write_files',
  EXECUTE_SHELL: 'execute_shell',
  INSTALL_SOFTWARE: 'install_software',
  LAUNCH_APPS: 'launch_apps',
  NETWORK_ACCESS: 'network_access',
  BROWSER_ACCESS: 'browser_access',
} as const;
export type PermissionType = (typeof PermissionType)[keyof typeof PermissionType];

export const PermissionDuration = {
  ONCE: 'once',
  SESSION: 'session',
  PERMANENT: 'permanent',
} as const;
export type PermissionDuration = (typeof PermissionDuration)[keyof typeof PermissionDuration];

// --- Core Models -------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  settings: UserSettings;
}

export interface UserSettings {
  defaultModel?: string;
  maxAgents?: number;
  theme?: 'light' | 'dark';
  notifications?: boolean;
}

export interface Agent {
  id: string;
  userId: string;
  teamId: string | null;
  name: string;
  role: string;
  specialty: string[];
  status: AgentStatus;
  isMainAgent: boolean;
  contextId: string | null;
  currentTaskId: string | null;
  capabilities: string[];
  personality: string | null;
  modelProvider: string;
  modelName: string | null;
  createdAt: Date;
  lastActive: Date;
  lastSyncAt: Date | null;
  stats: AgentStats;
}

export interface AgentStats {
  tasksCompleted: number;
  messagesProcessed: number;
  uptimeSeconds: number;
  successRate: number;
}

export interface Team {
  id: string;
  userId: string;
  name: string;
  description: string;
  goal: string;
  leadAgentId: string | null;
  sharedContext: string;
  status: TeamStatus;
  createdAt: Date;
}

export interface TaskAgentInfo {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface Task {
  id: string;
  userId: string;
  teamId: string | null;
  teamName?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdByAgentId: string | null;
  createdByAgentName?: string;
  assignedAgents?: TaskAgentInfo[];
  createdAt: Date;
  deadline: Date | null;
  progress: number;
  result: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
}

export interface Message {
  id: string;
  fromAgentId: string | null;
  fromAgentName?: string;
  fromUser: boolean;
  type: MessageType;
  content: string;
  metadata: MessageMetadata;
  createdAt: Date;
}

export interface MessageMetadata {
  taskId?: string;
  priority?: number;
  requiresResponse?: boolean;
}

export interface MessageRecipient {
  messageId: string;
  agentId: string | null;
  teamId: string | null;
  readAt: Date | null;
}

export interface Permission {
  id: string;
  agentId: string;
  permissionType: PermissionType;
  scope: string;
  granted: boolean;
  duration: PermissionDuration;
  expiresAt: Date | null;
  grantedAt: Date | null;
}

export interface AuditLogEntry {
  id: string;
  agentId: string | null;
  action: string;
  toolName: string | null;
  parameters: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  success: boolean;
  createdAt: Date;
}

export interface AgentContext {
  id: string;
  agentId: string;
  conversationHistory: Message[];
  knowledgeBase: Record<string, unknown>;
  workingMemory: Record<string, unknown>;
  updatedAt: Date;
}

// --- API DTOs ----------------------------------------------------------------

export interface CreateAgentDto {
  name: string;
  role: string;
  specialty: string[];
  teamId?: string;
  capabilities?: string[];
  isMainAgent?: boolean;
  personality?: string;
  modelProvider?: string;
  modelName?: string;
}

export interface UpdateAgentDto {
  name?: string;
  role?: string;
  specialty?: string[];
  teamId?: string | null;
  status?: AgentStatus;
  capabilities?: string[];
  personality?: string | null;
  modelProvider?: string;
  modelName?: string;
}

export interface CreateTeamDto {
  name: string;
  description: string;
  goal: string;
  leadAgentId?: string;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  goal?: string;
  leadAgentId?: string | null;
  status?: TeamStatus;
  sharedContext?: string;
}

export interface CreateTaskDto {
  title: string;
  description: string;
  teamId?: string;
  priority?: TaskPriority;
  deadline?: string;
  assignTo?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  progress?: number;
  deadline?: string | null;
  result?: Record<string, unknown>;
}

export interface SendMessageDto {
  to: string[];
  type: MessageType;
  content: string;
  metadata?: MessageMetadata;
}

export interface PermissionRequestDto {
  agentId: string;
  permissionType: PermissionType;
  scope: string;
  duration: PermissionDuration;
}

// --- Broadcast & Sync --------------------------------------------------------

export interface BroadcastMessage {
  type: 'sync' | 'announcement' | 'emergency';
  from: string;
  timestamp: Date;
  data: BroadcastData;
}

export interface BroadcastData {
  globalContext?: string;
  newTasks?: Task[];
  systemUpdates?: Record<string, unknown>;
  priorityChanges?: Record<string, unknown>;
}

export interface SyncResponse {
  agentId: string;
  status: 'success' | 'failed';
  updates?: Record<string, unknown>;
  completedTasks?: string[];
  issues?: string[];
  error?: string;
}

// --- API Responses -----------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- WebSocket Events --------------------------------------------------------

export interface WsEvents {
  'agent:status': { agentId: string; status: AgentStatus };
  'agent:message': Message;
  'task:update': { taskId: string; status: TaskStatus; progress: number };
  'team:update': { teamId: string; status: TeamStatus };
  'sync:start': { timestamp: Date };
  'sync:complete': { timestamp: Date; agentCount: number };
  'permission:request': Permission;
  'system:emergency_stop': { timestamp: Date };
}
