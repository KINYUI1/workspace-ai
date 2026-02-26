import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';
import type { Team, Agent, CreateTeamDto, UpdateTeamDto } from '@/types';

interface TeamWithCount extends Team {
  agentCount?: number;
}

interface TeamState {
  teams: TeamWithCount[];
  selectedTeam: (Team & { agents: Agent[] }) | null;
  isLoading: boolean;

  fetchTeams: () => Promise<void>;
  fetchTeam: (id: string) => Promise<void>;
  createTeam: (dto: CreateTeamDto) => Promise<Team>;
  updateTeam: (id: string, dto: UpdateTeamDto) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addAgentToTeam: (teamId: string, agentId: string) => Promise<void>;
  removeAgentFromTeam: (teamId: string, agentId: string) => Promise<void>;
  clearSelectedTeam: () => void;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  selectedTeam: null,
  isLoading: false,

  fetchTeams: async () => {
    const cached = await getCached<TeamWithCount[]>('teams');
    if (cached) set({ teams: cached.data });

    set({ isLoading: !cached });
    try {
      const res = await api.getTeams(1, 100);
      const teams = res.data ?? [];
      set({ teams, isLoading: false });
      await setCache('teams', teams);
    } catch {
      set({ isLoading: false });
    }
  },

  fetchTeam: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.getTeam(id);
      set({ selectedTeam: res.data ?? null, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTeam: async (dto) => {
    const res = await api.createTeam(dto);
    const team = res.data!;
    const teams = [...get().teams, { ...team, agentCount: 0 }];
    set({ teams });
    await setCache('teams', teams);
    return team;
  },

  updateTeam: async (id, dto) => {
    const res = await api.updateTeam(id, dto);
    const updated = res.data!;
    const teams = get().teams.map((t) => (t.id === id ? { ...t, ...updated } : t));
    set({ teams });
    await setCache('teams', teams);
  },

  deleteTeam: async (id) => {
    await api.deleteTeam(id);
    const teams = get().teams.filter((t) => t.id !== id);
    set({
      teams,
      ...(get().selectedTeam?.id === id ? { selectedTeam: null } : {}),
    });
    await setCache('teams', teams);
  },

  addAgentToTeam: async (teamId, agentId) => {
    await api.addAgentToTeam(teamId, agentId);
    if (get().selectedTeam?.id === teamId) {
      await get().fetchTeam(teamId);
    }
  },

  removeAgentFromTeam: async (teamId, agentId) => {
    await api.removeAgentFromTeam(teamId, agentId);
    if (get().selectedTeam?.id === teamId) {
      await get().fetchTeam(teamId);
    }
  },

  clearSelectedTeam: () => set({ selectedTeam: null }),
}));
