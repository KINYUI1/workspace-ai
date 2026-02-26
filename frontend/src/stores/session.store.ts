import { create } from 'zustand';
import { api } from '@/services/api';

export interface ChatSession {
  id: string;
  userId: string;
  agentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;

  fetchSessions: () => Promise<void>;
  createSession: (name?: string, agentId?: string) => Promise<ChatSession>;
  switchSession: (id: string) => void;
  renameSession: (id: string, name: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,

  fetchSessions: async () => {
    set({ isLoading: true });
    try {
      const res = await api.getSessions();
      set({ sessions: res.data ?? [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createSession: async (name?, agentId?) => {
    const res = await api.createSession(name, agentId);
    const session = res.data!;
    const sessions = [session, ...get().sessions];
    set({ sessions, activeSessionId: session.id });
    return session;
  },

  switchSession: (id) => {
    set({ activeSessionId: id });
  },

  renameSession: async (id, name) => {
    await api.renameSession(id, name);
    set({
      sessions: get().sessions.map((s) =>
        s.id === id ? { ...s, name } : s,
      ),
    });
  },

  deleteSession: async (id) => {
    await api.deleteSession(id);
    const state = get();
    const sessions = state.sessions.filter((s) => s.id !== id);
    set({
      sessions,
      activeSessionId: state.activeSessionId === id
        ? sessions[0]?.id ?? null
        : state.activeSessionId,
    });
  },
}));
