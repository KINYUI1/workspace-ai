import { useEffect } from 'react';
import { getSocket } from '@/services/socket';
import { useAgentStore } from '@/stores/agent.store';
import { useTeamStore } from '@/stores/team.store';
import { useTaskStore } from '@/stores/task.store';
import { useChatStore } from '@/stores/chat.store';
import { useOrganizationStore } from '@/stores/organization.store';
import { useFileStore } from '@/stores/file.store';
import { useLogStore, type LogEntry } from '@/stores/log.store';
import { useUsageStore } from '@/stores/usage.store';
import { useCanvasStore } from '@/stores/canvas.store';
import type { Task } from '@/types';

/**
 * Subscribes to WebSocket events and dispatches updates to stores.
 * Mount this once in the authenticated app layout.
 */
export function useSocket() {
  const updateAgentStatus = useAgentStore((s) => s.updateAgentStatus);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const updateTaskProgress = useTaskStore((s) => s.updateTaskProgress);
  const replaceTask = useTaskStore((s) => s.replaceTask);
  const addAgentMessage = useChatStore((s) => s.addAgentMessage);
  const fetchOrganizations = useOrganizationStore((s) => s.fetchOrganizations);
  const fetchFiles = useFileStore((s) => s.fetchFiles);
  const fetchTree = useFileStore((s) => s.fetchTree);

  // Streaming handlers
  const onStreamStart = useChatStore((s) => s.onStreamStart);
  const onStreamDelta = useChatStore((s) => s.onStreamDelta);
  const onStreamThinking = useChatStore((s) => s.onStreamThinking);
  const onStreamToolUse = useChatStore((s) => s.onStreamToolUse);
  const onStreamToolResult = useChatStore((s) => s.onStreamToolResult);
  const onStreamUsage = useChatStore((s) => s.onStreamUsage);
  const onStreamDone = useChatStore((s) => s.onStreamDone);
  const onStreamError = useChatStore((s) => s.onStreamError);

  // Log & usage handlers
  const addLogEntry = useLogStore((s) => s.addEntry);
  const addUsage = useUsageStore((s) => s.addUsage);

  // Canvas handler
  const setCanvasContent = useCanvasStore((s) => s.setContent);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAgentStatus = (data: { agentId: string; status: string }) => {
      updateAgentStatus(data.agentId, data.status);
    };

    const onAgentMessage = (data: { id: string; content: string; agentName?: string }) => {
      addAgentMessage({
        id: data.id || `agent-${Date.now()}`,
        role: 'agent',
        content: data.content,
        agentName: data.agentName,
        timestamp: new Date(),
      });
    };

    const onAgentToolUse = (data: { agentId: string; agentName: string; tool: string; input: Record<string, unknown> }) => {
      // Show tool usage as an action message in chat
      const toolLabel = data.tool.replace(/_/g, ' ');
      const details = data.tool === 'create_file'
        ? `Creating file: ${data.input.path ?? '(unknown)'}`
        : data.tool === 'send_message'
          ? `Sending message to agent`
          : data.tool === 'search_web'
            ? `Searching: ${data.input.query ?? ''}`
            : data.tool === 'execute_code'
              ? `Running ${data.input.language ?? 'code'}...`
              : `Using ${toolLabel}`;
      addAgentMessage({
        id: `tool-${Date.now()}-${data.agentId}`,
        role: 'agent',
        content: '',
        agentName: data.agentName,
        timestamp: new Date(),
        action: { type: toolLabel, details },
      });
    };

    const onTaskUpdate = (data: { taskId: string; status: string; progress: number }) => {
      updateTaskProgress(data.taskId, data.status, data.progress);
    };

    const onTaskUpdated = (data: Task) => {
      replaceTask(data);
    };

    // Log events
    const onLogEvent = (data: LogEntry) => {
      addLogEntry(data);
    };

    // Usage events from streaming
    const onUsageEvent = (data: { inputTokens: number; outputTokens: number }) => {
      addUsage(data.inputTokens, data.outputTokens);
    };

    // Re-fetch lists when Atlas creates new resources
    const onAgentCreated = () => fetchAgents();
    const onTeamCreated = () => fetchTeams();
    const onTeamUpdated = () => fetchTeams();
    const onTaskCreated = () => fetchTasks();
    const onOrgCreated = () => fetchOrganizations();
    const onDeptCreated = () => fetchOrganizations();
    const onFileCreated = () => {
      fetchFiles();
      fetchTree();
    };

    // Legacy events
    socket.on('agent:status', onAgentStatus);
    socket.on('agent:message', onAgentMessage);
    socket.on('agent:tool_use', onAgentToolUse);
    socket.on('agent:created', onAgentCreated);
    socket.on('task:update', onTaskUpdate);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:created', onTaskCreated);
    socket.on('team:created', onTeamCreated);
    socket.on('team:updated', onTeamUpdated);
    socket.on('organization:created', onOrgCreated);
    socket.on('department:created', onDeptCreated);
    socket.on('file:created', onFileCreated);

    // Streaming events
    socket.on('agent:stream:start', onStreamStart);
    socket.on('agent:stream:delta', onStreamDelta);
    socket.on('agent:stream:thinking', onStreamThinking);
    socket.on('agent:stream:tool_use', onStreamToolUse);
    socket.on('agent:stream:tool_result', onStreamToolResult);
    socket.on('agent:stream:usage', onStreamUsage);
    socket.on('agent:stream:done', onStreamDone);
    socket.on('agent:stream:error', onStreamError);

    // Log & usage events
    socket.on('system:log', onLogEvent);
    socket.on('agent:usage', onUsageEvent);

    // Canvas events
    const onCanvasUpdate = (data: { content: string; contentType: string; title?: string }) => {
      setCanvasContent(data.content, data.contentType as any, data.title);
    };
    socket.on('canvas:update', onCanvasUpdate);

    return () => {
      socket.off('agent:status', onAgentStatus);
      socket.off('agent:message', onAgentMessage);
      socket.off('agent:tool_use', onAgentToolUse);
      socket.off('agent:created', onAgentCreated);
      socket.off('task:update', onTaskUpdate);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:created', onTaskCreated);
      socket.off('team:created', onTeamCreated);
      socket.off('team:updated', onTeamUpdated);
      socket.off('organization:created', onOrgCreated);
      socket.off('department:created', onDeptCreated);
      socket.off('file:created', onFileCreated);

      // Streaming events
      socket.off('agent:stream:start', onStreamStart);
      socket.off('agent:stream:delta', onStreamDelta);
      socket.off('agent:stream:thinking', onStreamThinking);
      socket.off('agent:stream:tool_use', onStreamToolUse);
      socket.off('agent:stream:tool_result', onStreamToolResult);
      socket.off('agent:stream:usage', onStreamUsage);
      socket.off('agent:stream:done', onStreamDone);
      socket.off('agent:stream:error', onStreamError);

      // Log & usage events
      socket.off('system:log', onLogEvent);
      socket.off('agent:usage', onUsageEvent);

      // Canvas events
      socket.off('canvas:update', onCanvasUpdate);
    };
  }, [
    updateAgentStatus, fetchAgents, fetchTeams, fetchTasks, updateTaskProgress,
    replaceTask, addAgentMessage, fetchOrganizations, fetchFiles, fetchTree,
    onStreamStart, onStreamDelta, onStreamThinking, onStreamToolUse,
    onStreamToolResult, onStreamUsage, onStreamDone, onStreamError,
    addLogEntry, addUsage, setCanvasContent,
  ]);
}
