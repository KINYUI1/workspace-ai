// Re-export shared types and add frontend-specific types
export type {
  Agent,
  AgentStats,
  Team,
  Task,
  Message,
  MessageMetadata,
  Permission,
  AuditLogEntry,
  AgentStatus,
  TeamStatus,
  TaskPriority,
  TaskStatus,
  MessageType,
  PermissionType,
  ApiResponse,
  ApiError,
  PaginationMeta,
  CreateAgentDto,
  UpdateAgentDto,
  CreateTeamDto,
  UpdateTeamDto,
  CreateTaskDto,
  UpdateTaskDto,
  SendMessageDto,
  WsEvents,
} from '../../../shared/types';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface TeamWithAgents extends Omit<import('../../../shared/types').Team, never> {
  agents: import('../../../shared/types').Agent[];
  agentCount?: number;
}

export interface TaskWithAssignees extends Omit<import('../../../shared/types').Task, never> {
  assignedTo: string[];
}
