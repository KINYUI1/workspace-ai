import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';
import type { Message } from '@/types';

export interface ToolUseEvent {
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  agentName?: string;
  timestamp: Date;
  isThinking?: boolean;
  thinkingContent?: string;
  tools?: ToolUseEvent[];
  usage?: { inputTokens: number; outputTokens: number };
  action?: {
    type: string;
    details: string;
  };
}

interface StreamingState {
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingAgentId: string | null;
  streamingAgentName: string | null;
  streamingText: string;
  streamingThinking: string;
  streamingTools: ToolUseEvent[];
  streamingUsage: { inputTokens: number; outputTokens: number } | null;
}

interface ChatState extends StreamingState {
  messages: ChatMessage[];
  isLoading: boolean;

  sendMessage: (content: string, mainAgentId: string) => Promise<void>;
  addAgentMessage: (message: ChatMessage) => void;
  loadHistory: (agentId: string) => Promise<void>;
  clearChat: () => void;

  // Streaming handlers
  onStreamStart: (data: { messageId: string; agentId: string; agentName: string }) => void;
  onStreamDelta: (data: { messageId: string; text: string }) => void;
  onStreamThinking: (data: { messageId: string; text: string }) => void;
  onStreamToolUse: (data: { messageId: string; agentName: string; toolId: string; toolName: string; input: Record<string, unknown> }) => void;
  onStreamToolResult: (data: { messageId: string; toolId: string; toolName: string; result: unknown; durationMs: number }) => void;
  onStreamUsage: (data: { messageId: string; inputTokens: number; outputTokens: number }) => void;
  onStreamDone: (data: { messageId: string; agentId: string; agentName: string; content: string; timestamp: string }) => void;
  onStreamError: (data: { messageId: string; agentId: string; error: string }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,

  // Streaming state
  isStreaming: false,
  streamingMessageId: null,
  streamingAgentId: null,
  streamingAgentName: null,
  streamingText: '',
  streamingThinking: '',
  streamingTools: [],
  streamingUsage: null,

  sendMessage: async (content, mainAgentId) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const messages = [...get().messages, userMsg];
    set({ messages, isLoading: true });
    setCache(`chat:${mainAgentId}`, messages);

    try {
      await api.sendMessage({
        to: [mainAgentId],
        type: 'direct',
        content,
      });
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addAgentMessage: (message) => {
    const messages = [...get().messages, message];
    set({ messages });
  },

  loadHistory: async (agentId) => {
    const cached = await getCached<ChatMessage[]>(`chat:${agentId}`);
    if (cached) set({ messages: cached.data });

    try {
      const res = await api.getAgentMessages(agentId, 1, 50);
      const apiMessages = (res.data ?? []) as Message[];

      const chatMessages: ChatMessage[] = apiMessages.map((m) => ({
        id: m.id,
        role: m.fromUser ? 'user' : 'agent',
        content: m.content,
        agentName: m.fromAgentName,
        timestamp: new Date(m.createdAt),
      }));

      const messages = chatMessages.reverse();
      set({ messages });
      await setCache(`chat:${agentId}`, messages);
    } catch {
      // Cached data remains visible
    }
  },

  clearChat: () => set({ messages: [] }),

  // --- Streaming Handlers ---

  onStreamStart: (data) => {
    set({
      isStreaming: true,
      isLoading: false,
      streamingMessageId: data.messageId,
      streamingAgentId: data.agentId,
      streamingAgentName: data.agentName,
      streamingText: '',
      streamingThinking: '',
      streamingTools: [],
      streamingUsage: null,
    });
  },

  onStreamDelta: (data) => {
    const state = get();
    if (data.messageId !== state.streamingMessageId) return;
    set({ streamingText: state.streamingText + data.text });
  },

  onStreamThinking: (data) => {
    const state = get();
    if (data.messageId !== state.streamingMessageId) return;
    set({ streamingThinking: state.streamingThinking + data.text });
  },

  onStreamToolUse: (data) => {
    const state = get();
    if (data.messageId !== state.streamingMessageId) return;
    set({
      streamingTools: [
        ...state.streamingTools,
        {
          toolId: data.toolId,
          toolName: data.toolName,
          input: data.input,
          status: 'running',
        },
      ],
    });
  },

  onStreamToolResult: (data) => {
    const state = get();
    if (data.messageId !== state.streamingMessageId) return;
    set({
      streamingTools: state.streamingTools.map((t) =>
        t.toolId === data.toolId
          ? { ...t, result: data.result, durationMs: data.durationMs, status: 'completed' as const }
          : t,
      ),
    });
  },

  onStreamUsage: (data) => {
    const state = get();
    if (data.messageId !== state.streamingMessageId) return;
    set({
      streamingUsage: { inputTokens: data.inputTokens, outputTokens: data.outputTokens },
    });
  },

  onStreamDone: (data) => {
    const state = get();
    // Finalize the streaming message into the messages array
    const finalMessage: ChatMessage = {
      id: data.messageId,
      role: 'agent',
      content: data.content,
      agentName: data.agentName,
      timestamp: new Date(data.timestamp),
      thinkingContent: state.streamingThinking || undefined,
      tools: state.streamingTools.length > 0 ? state.streamingTools : undefined,
      usage: state.streamingUsage || undefined,
    };

    set({
      messages: [...state.messages, finalMessage],
      isStreaming: false,
      streamingMessageId: null,
      streamingAgentId: null,
      streamingAgentName: null,
      streamingText: '',
      streamingThinking: '',
      streamingTools: [],
      streamingUsage: null,
    });
  },

  onStreamError: (data) => {
    const state = get();
    // Add error message and reset streaming
    const errorMessage: ChatMessage = {
      id: data.messageId || `error-${Date.now()}`,
      role: 'agent',
      content: `Error: ${data.error}`,
      timestamp: new Date(),
    };

    set({
      messages: [...state.messages, errorMessage],
      isStreaming: false,
      streamingMessageId: null,
      streamingAgentId: null,
      streamingAgentName: null,
      streamingText: '',
      streamingThinking: '',
      streamingTools: [],
      streamingUsage: null,
    });
  },
}));
