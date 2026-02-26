import { create } from 'zustand';
import { api } from '@/services/api';

export interface ChannelInfo {
  id: string;
  type: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface ChannelAdapter {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  configSchema: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    description?: string;
  }>;
}

interface ChannelState {
  channels: ChannelInfo[];
  catalog: ChannelAdapter[];
  isLoading: boolean;

  fetchChannels: () => Promise<void>;
  fetchCatalog: () => Promise<void>;
  connectChannel: (type: string, name: string, config: Record<string, unknown>) => Promise<void>;
  disconnectChannel: (id: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  catalog: [],
  isLoading: false,

  fetchChannels: async () => {
    set({ isLoading: true });
    try {
      const res = await api.getChannels();
      set({ channels: (res as any).data ?? [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchCatalog: async () => {
    try {
      const res = await api.getChannelCatalog();
      set({ catalog: (res as any).data ?? [] });
    } catch {
      // ignore
    }
  },

  connectChannel: async (type, name, config) => {
    const res = await api.connectChannel(type, name, config);
    const channel = (res as any).data;
    set({ channels: [...get().channels, channel] });
  },

  disconnectChannel: async (id) => {
    await api.disconnectChannel(id);
    set({ channels: get().channels.filter((ch) => ch.id !== id) });
  },
}));
