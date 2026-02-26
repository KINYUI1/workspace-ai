import { create } from 'zustand';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: 'agent' | 'system' | 'task' | 'tool';
  agentName?: string;
  message: string;
  details?: Record<string, unknown>;
}

interface LogState {
  entries: LogEntry[];
  maxEntries: number;
  filter: {
    level: string | null;
    source: string | null;
    search: string;
  };

  addEntry: (entry: LogEntry) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogState['filter']>) => void;
  getFilteredEntries: () => LogEntry[];
  exportAsJSON: () => string;
  exportAsCSV: () => string;
}

export const useLogStore = create<LogState>((set, get) => ({
  entries: [],
  maxEntries: 1000,
  filter: {
    level: null,
    source: null,
    search: '',
  },

  addEntry: (entry) => {
    const state = get();
    const entries = [entry, ...state.entries].slice(0, state.maxEntries);
    set({ entries });
  },

  clearLogs: () => set({ entries: [] }),

  setFilter: (filter) => {
    set({ filter: { ...get().filter, ...filter } });
  },

  getFilteredEntries: () => {
    const { entries, filter } = get();
    return entries.filter((e) => {
      if (filter.level && e.level !== filter.level) return false;
      if (filter.source && e.source !== filter.source) return false;
      if (filter.search) {
        const search = filter.search.toLowerCase();
        return (
          e.message.toLowerCase().includes(search) ||
          e.agentName?.toLowerCase().includes(search) ||
          false
        );
      }
      return true;
    });
  },

  exportAsJSON: () => {
    return JSON.stringify(get().getFilteredEntries(), null, 2);
  },

  exportAsCSV: () => {
    const entries = get().getFilteredEntries();
    const header = 'timestamp,level,source,agent,message\n';
    const rows = entries.map((e) =>
      `"${e.timestamp}","${e.level}","${e.source}","${e.agentName || ''}","${e.message.replace(/"/g, '""')}"`
    ).join('\n');
    return header + rows;
  },
}));
