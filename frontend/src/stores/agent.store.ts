import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';
import type { Agent, CreateAgentDto, UpdateAgentDto } from '@/types';

interface AgentState {
  agents: Agent[];
  mainAgent: Agent | null;
  selectedAgent: Agent | null;
  isLoading: boolean;

  fetchAgents: () => Promise<void>;
  fetchMainAgent: () => Promise<void>;
  createAgent: (dto: CreateAgentDto) => Promise<Agent>;
  updateAgent: (id: string, dto: UpdateAgentDto) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (agent: Agent | null) => void;
  updateAgentStatus: (agentId: string, status: string) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  mainAgent: null,
  selectedAgent: null,
  isLoading: false,

  fetchAgents: async () => {
    const cached = await getCached<Agent[]>('agents');
    if (cached) set({ agents: cached.data });

    set({ isLoading: !cached });
    try {
      const res = await api.getAgents(1, 100);
      const agents = res.data ?? [];
      set({ agents, isLoading: false });
      await setCache('agents', agents);
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMainAgent: async () => {
    const cached = await getCached<Agent | null>('mainAgent');
    if (cached) set({ mainAgent: cached.data });

    try {
      const res = await api.getMainAgent();
      const mainAgent = res.data ?? null;
      set({ mainAgent });
      await setCache('mainAgent', mainAgent);
    } catch {
      // Main agent may not exist yet
    }
  },

  createAgent: async (dto) => {
    const res = await api.createAgent(dto);
    const agent = res.data!;
    const agents = [...get().agents, agent];
    set({ agents });
    if (agent.isMainAgent) set({ mainAgent: agent });
    await setCache('agents', agents);
    return agent;
  },

  updateAgent: async (id, dto) => {
    const res = await api.updateAgent(id, dto);
    const updated = res.data!;
    const agents = get().agents.map((a) => (a.id === id ? updated : a));
    set({
      agents,
      ...(get().mainAgent?.id === id ? { mainAgent: updated } : {}),
      ...(get().selectedAgent?.id === id ? { selectedAgent: updated } : {}),
    });
    await setCache('agents', agents);
  },

  deleteAgent: async (id) => {
    await api.deleteAgent(id);
    const agents = get().agents.filter((a) => a.id !== id);
    set({
      agents,
      ...(get().selectedAgent?.id === id ? { selectedAgent: null } : {}),
    });
    await setCache('agents', agents);
  },

  selectAgent: (agent) => set({ selectedAgent: agent }),

  updateAgentStatus: (agentId, status) => {
    const agents = get().agents.map((a) =>
      a.id === agentId ? { ...a, status: status as Agent['status'] } : a,
    );
    set({
      agents,
      ...(get().mainAgent?.id === agentId
        ? { mainAgent: { ...get().mainAgent!, status: status as Agent['status'] } }
        : {}),
    });
    // Fire-and-forget cache update for status changes
    setCache('agents', agents);
  },
}));
