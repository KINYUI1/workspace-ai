import type {
  ApiResponse,
  AuthResponse,
  Agent,
  Team,
  Task,
  Message,
  Permission,
  AuditLogEntry,
  PaginationMeta,
  CreateAgentDto,
  UpdateAgentDto,
  CreateTeamDto,
  UpdateTeamDto,
  CreateTaskDto,
  UpdateTaskDto,
  SendMessageDto,
} from '@/types';

const BASE_URL = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return { success: true };
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error?.code || 'UNKNOWN',
        data.error?.message || 'An error occurred',
        response.status,
      );
    }

    return data;
  }

  private get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  private post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private patch<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  private delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // --- Auth ----------------------------------------------------------------

  register(email: string, password: string, name: string) {
    return this.post<AuthResponse>('/auth/register', { email, password, name });
  }

  login(email: string, password: string) {
    return this.post<AuthResponse>('/auth/login', { email, password });
  }

  getProfile() {
    return this.get<{ id: string; email: string; name: string }>('/auth/me');
  }

  getDesktopToken() {
    return this.get<AuthResponse>('/auth/desktop-token');
  }

  // --- Agents --------------------------------------------------------------

  createAgent(dto: CreateAgentDto) {
    return this.post<Agent>('/agents', dto);
  }

  getAgents(page = 1, limit = 20) {
    return this.request<Agent[]>(`/agents?page=${page}&limit=${limit}`) as Promise<
      ApiResponse<Agent[]> & { meta?: PaginationMeta }
    >;
  }

  getAgent(id: string) {
    return this.get<Agent>(`/agents/${id}`);
  }

  getMainAgent() {
    return this.get<Agent | null>('/agents/main');
  }

  updateAgent(id: string, dto: UpdateAgentDto) {
    return this.patch<Agent>(`/agents/${id}`, dto);
  }

  deleteAgent(id: string) {
    return this.delete(`/agents/${id}`);
  }

  // --- Teams ---------------------------------------------------------------

  createTeam(dto: CreateTeamDto) {
    return this.post<Team>('/teams', dto);
  }

  getTeams(page = 1, limit = 20) {
    return this.request<(Team & { agentCount: number })[]>(
      `/teams?page=${page}&limit=${limit}`,
    ) as Promise<ApiResponse<(Team & { agentCount: number })[]> & { meta?: PaginationMeta }>;
  }

  getTeam(id: string) {
    return this.get<Team & { agents: Agent[] }>(`/teams/${id}`);
  }

  updateTeam(id: string, dto: UpdateTeamDto) {
    return this.patch<Team>(`/teams/${id}`, dto);
  }

  deleteTeam(id: string) {
    return this.delete(`/teams/${id}`);
  }

  addAgentToTeam(teamId: string, agentId: string) {
    return this.post(`/teams/${teamId}/agents/${agentId}`);
  }

  removeAgentFromTeam(teamId: string, agentId: string) {
    return this.delete(`/teams/${teamId}/agents/${agentId}`);
  }

  // --- Tasks ---------------------------------------------------------------

  createTask(dto: CreateTaskDto) {
    return this.post<Task>('/tasks', dto);
  }

  getTasks(page = 1, limit = 20, filters?: Record<string, string>) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    }
    return this.request<Task[]>(`/tasks?${params}`) as Promise<
      ApiResponse<Task[]> & { meta?: PaginationMeta }
    >;
  }

  getTask(id: string) {
    return this.get<Task & { assignedTo: string[] }>(`/tasks/${id}`);
  }

  updateTask(id: string, dto: UpdateTaskDto) {
    return this.patch<Task>(`/tasks/${id}`, dto);
  }

  deleteTask(id: string) {
    return this.delete(`/tasks/${id}`);
  }

  assignAgentToTask(taskId: string, agentId: string) {
    return this.post(`/tasks/${taskId}/assign/${agentId}`);
  }

  unassignAgentFromTask(taskId: string, agentId: string) {
    return this.delete(`/tasks/${taskId}/assign/${agentId}`);
  }

  // --- Messages ------------------------------------------------------------

  sendMessage(dto: SendMessageDto) {
    return this.post<Message>('/messages', dto);
  }

  getUsageLimit() {
    return this.get<{
      used: number;
      limit: number | null;
      remaining: number | null;
      unlimited: boolean;
      resetsIn: string;
    }>('/messages/usage-limit');
  }

  getAgentMessages(agentId: string, page = 1, limit = 50) {
    return this.get<Message[]>(`/messages/agent/${agentId}?page=${page}&limit=${limit}`);
  }

  getTeamMessages(teamId: string, page = 1, limit = 50) {
    return this.get<Message[]>(`/messages/team/${teamId}?page=${page}&limit=${limit}`);
  }

  // --- Organizations -------------------------------------------------------

  getOrganizations(page = 1, limit = 20) {
    return this.get<unknown[]>(`/organizations?page=${page}&limit=${limit}`);
  }

  getOrganization(id: string) {
    return this.get<unknown>(`/organizations/${id}`);
  }

  createOrganization(dto: { name: string; description?: string }) {
    return this.post<unknown>('/organizations', dto);
  }

  deleteOrganization(id: string) {
    return this.delete(`/organizations/${id}`);
  }

  getDepartments(orgId: string, page = 1, limit = 20) {
    return this.get<unknown[]>(`/organizations/${orgId}/departments?page=${page}&limit=${limit}`);
  }

  createDepartment(orgId: string, dto: { name: string; description?: string }) {
    return this.post<unknown>(`/organizations/${orgId}/departments`, dto);
  }

  deleteDepartment(orgId: string, deptId: string) {
    return this.delete(`/organizations/${orgId}/departments/${deptId}`);
  }

  assignTeamToDepartment(orgId: string, deptId: string, teamId: string) {
    return this.post(`/organizations/${orgId}/departments/${deptId}/teams/${teamId}`);
  }

  removeTeamFromDepartment(orgId: string, deptId: string, teamId: string) {
    return this.delete(`/organizations/${orgId}/departments/${deptId}/teams/${teamId}`);
  }

  moveDepartment(orgId: string, deptId: string, targetOrganizationId: string) {
    return this.patch(`/organizations/${orgId}/departments/${deptId}/move`, { targetOrganizationId });
  }

  // --- Files ---------------------------------------------------------------

  getFiles(prefix?: string) {
    const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    return this.get<unknown[]>(`/files${params}`);
  }

  getFileTree() {
    return this.get<unknown>('/files/tree');
  }

  getFileByPath(path: string) {
    return this.get<unknown>(`/files/by-path?path=${encodeURIComponent(path)}`);
  }

  createFile(dto: { path: string; content: string; language?: string }) {
    return this.post<unknown>('/files', dto);
  }

  deleteFile(path: string) {
    return this.delete(`/files/by-path?path=${encodeURIComponent(path)}`);
  }

  async downloadFile(path: string) {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${BASE_URL}/files/download?path=${encodeURIComponent(path)}`, { headers });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const fileName = path.split('/').pop() || 'file';
    triggerBlobDownload(blob, fileName);
  }

  async downloadDirectory(prefix: string) {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${BASE_URL}/files/download-dir?prefix=${encodeURIComponent(prefix)}`, { headers });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const dirName = prefix.replace(/\/$/, '').split('/').pop() || 'files';
    triggerBlobDownload(blob, `${dirName}.zip`);
  }

  // --- Code Execution ---------------------------------------------------------

  executeCode(language: 'python' | 'javascript' | 'bash', code: string) {
    return this.post<{
      stdout: string;
      stderr: string;
      exitCode: number;
      executionTimeMs: number;
      timedOut: boolean;
    }>('/execute', { language, code });
  }

  // --- Settings ---------------------------------------------------------------

  getSettings() {
    return this.get<unknown>('/settings');
  }

  updateSettings(dto: Record<string, unknown>) {
    return this.patch<unknown>('/settings', dto);
  }

  // --- Scheduled Tasks ------------------------------------------------------

  getScheduledTasks() {
    return this.get<unknown[]>('/scheduled-tasks');
  }

  createScheduledTask(dto: Record<string, unknown>) {
    return this.post<unknown>('/scheduled-tasks', dto);
  }

  cancelScheduledTask(id: string) {
    return this.delete(`/scheduled-tasks/${id}`);
  }

  // --- Skills ---------------------------------------------------------------

  getSkills() {
    return this.get<unknown[]>('/skills');
  }

  createSkill(dto: Record<string, unknown>) {
    return this.post<unknown>('/skills', dto);
  }

  deleteSkill(id: string) {
    return this.delete(`/skills/${id}`);
  }

  getAgentSkills(agentId: string) {
    return this.get<unknown[]>(`/skills/agent/${agentId}`);
  }

  enableSkillForAgent(agentId: string, skillId: string) {
    return this.post(`/skills/agent/${agentId}/${skillId}`);
  }

  disableSkillForAgent(agentId: string, skillId: string) {
    return this.delete(`/skills/agent/${agentId}/${skillId}`);
  }

  // --- Integrations --------------------------------------------------------

  getIntegrations(category?: string) {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.get<unknown[]>(`/integrations${params}`);
  }

  getIntegration(id: string) {
    return this.get<unknown>(`/integrations/${id}`);
  }

  getUserIntegrationConnections() {
    return this.get<unknown[]>('/integrations/user/connections');
  }

  connectIntegration(integrationId: string, credentials: Record<string, unknown> = {}, config?: Record<string, unknown>) {
    return this.post<unknown>('/integrations/connect', { integrationId, credentials, config });
  }

  disconnectIntegration(integrationId: string) {
    return this.post<unknown>(`/integrations/disconnect/${integrationId}`);
  }

  updateIntegrationConfig(integrationId: string, config: Record<string, unknown>) {
    return this.patch<unknown>(`/integrations/connections/${integrationId}/config`, { config });
  }

  getIntegrationLogs(integrationId: string, limit = 50) {
    return this.get<unknown[]>(`/integrations/connections/${integrationId}/logs?limit=${limit}`);
  }

  getOAuthAuthorizeUrl(integrationSlug: string) {
    return this.get<{ authorizationUrl: string }>(`/integrations/oauth/authorize/${integrationSlug}`);
  }

  executeIntegrationAction(integrationId: string, action: string, input: Record<string, unknown> = {}) {
    return this.post<{ success: boolean; data?: unknown; error?: string }>(`/integrations/execute/${integrationId}`, { action, input });
  }

  testIntegrationConnection(integrationId: string) {
    return this.post<{ valid: boolean; error?: string }>(`/integrations/test/${integrationId}`);
  }

  // --- Text-to-Speech ------------------------------------------------------

  async synthesizeSpeech(text: string, voice?: string, provider?: 'openai' | 'edge' | 'auto'): Promise<ArrayBuffer> {
    const res = await fetch(`${BASE_URL}/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ text, voice, provider: provider || 'auto' }),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.statusText}`);
    return res.arrayBuffer();
  }

  // --- Permissions ---------------------------------------------------------

  getPendingPermissions() {
    return this.get<Permission[]>('/permissions/pending');
  }

  decidePermission(id: string, granted: boolean) {
    return this.post<Permission>(`/permissions/${id}/decide`, { granted });
  }

  getAuditLog(page = 1, limit = 50) {
    return this.get<AuditLogEntry[]>(`/permissions/audit?page=${page}&limit=${limit}`);
  }

  // --- Approvals ------------------------------------------------------------

  respondToApproval(approvalId: string, decision: 'approved' | 'denied', alwaysAllow = false) {
    return this.post<{ ok: boolean; decision: string }>(`/approvals/${approvalId}/respond`, {
      decision,
      alwaysAllow,
    });
  }

  // --- Sessions -------------------------------------------------------------

  getSessions() {
    return this.get<any[]>('/sessions');
  }

  createSession(name?: string, agentId?: string) {
    return this.post<any>('/sessions', { name, agentId });
  }

  renameSession(id: string, name: string) {
    return this.patch<any>(`/sessions/${id}`, { name });
  }

  deleteSession(id: string) {
    return this.delete(`/sessions/${id}`);
  }

  // --- Channels --------------------------------------------------------------

  getChannels() {
    return this.get<unknown[]>('/channels');
  }

  getChannelCatalog() {
    return this.get<unknown[]>('/channels/catalog');
  }

  connectChannel(type: string, name: string, config: Record<string, unknown>) {
    return this.post<unknown>('/channels', { type, name, config });
  }

  disconnectChannel(id: string) {
    return this.delete(`/channels/${id}`);
  }

  // --- Plugins ---------------------------------------------------------------

  getPlugins() {
    return this.get<unknown[]>('/plugins');
  }

  enablePlugin(name: string) {
    return this.post<{ ok: boolean }>(`/plugins/${encodeURIComponent(name)}/enable`);
  }

  disablePlugin(name: string) {
    return this.post<{ ok: boolean }>(`/plugins/${encodeURIComponent(name)}/disable`);
  }

  installPlugin(pluginPath: string) {
    return this.post<unknown>('/plugins/install', { path: pluginPath });
  }

  createPlugin(dto: { name: string; kind: string; description?: string }) {
    return this.post<unknown>('/plugins/create', dto);
  }

  // --- Memory ----------------------------------------------------------------

  getMemoryDocuments() {
    return this.get<unknown[]>('/memory/documents');
  }

  getMemoryStats() {
    return this.get<unknown>('/memory/stats');
  }

  searchMemory(query: string) {
    return this.post<unknown[]>('/memory/search', { query });
  }

  indexMemoryDocument(name: string, content: string) {
    return this.post<unknown>('/memory/documents', { name, content });
  }

  deleteMemoryDocument(id: string) {
    return this.delete(`/memory/documents/${id}`);
  }

  // --- Cron Jobs -------------------------------------------------------------

  getCronJobs() {
    return this.get<unknown[]>('/cron-jobs');
  }

  createCronJob(dto: Record<string, unknown>) {
    return this.post<unknown>('/cron-jobs', dto);
  }

  updateCronJob(id: string, dto: Record<string, unknown>) {
    return this.patch<unknown>(`/cron-jobs/${id}`, dto);
  }

  deleteCronJob(id: string) {
    return this.delete(`/cron-jobs/${id}`);
  }

  getCronJobHistory(id: string) {
    return this.get<unknown[]>(`/cron-jobs/${id}/history`);
  }

  // --- Feedback --------------------------------------------------------------

  getFeedback() {
    return this.get<any[]>('/feedback');
  }

  getFeedbackStats() {
    return this.get<{ total: number; byType: Record<string, number>; byStatus: Record<string, number> }>('/feedback/stats');
  }

  createFeedback(dto: { type: string; rating?: number; message: string; metadata?: Record<string, unknown> }) {
    return this.post<any>('/feedback', dto);
  }

  updateFeedback(id: string, dto: { status: string }) {
    return this.patch<any>(`/feedback/${id}`, dto);
  }

  deleteFeedback(id: string) {
    return this.delete(`/feedback/${id}`);
  }

  // --- Feedback Admin (owner-only) -------------------------------------------

  getAdminFeedback() {
    return this.get<any[]>('/feedback/admin/all');
  }

  getAdminFeedbackStats() {
    return this.get<{ total: number; byType: Record<string, number>; byStatus: Record<string, number>; uniqueUsers: number }>('/feedback/admin/stats');
  }

  updateAdminFeedback(id: string, dto: { status: string }) {
    return this.patch<any>(`/feedback/admin/${id}`, dto);
  }

  deleteAdminFeedback(id: string) {
    return this.delete(`/feedback/admin/${id}`);
  }
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = new ApiClient();
