import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';

interface UserSettings {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  braveApiKey?: string;
  ollamaBaseUrl?: string;
  emailNotifications?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  settings: UserSettings;
  isLoading: boolean;
  isSaving: boolean;
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';

  fetchSettings: () => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

// Load persisted theme preference
const savedTheme = (localStorage.getItem('workspace-ai-theme') || 'dark') as ThemeMode;
const initialResolved = resolveTheme(savedTheme);
// Apply immediately to avoid flash
if (typeof document !== 'undefined') applyTheme(initialResolved);

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {},
  isLoading: false,
  isSaving: false,
  theme: savedTheme,
  resolvedTheme: initialResolved,

  fetchSettings: async () => {
    const cached = await getCached<UserSettings>('settings');
    if (cached) set({ settings: cached.data });

    set({ isLoading: !cached });
    try {
      const data = await api.getSettings();
      const settings = data as UserSettings;
      set({ settings });
      await setCache('settings', settings);
    } catch {
      // ignore
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (patch) => {
    set({ isSaving: true });
    try {
      const data = await api.updateSettings(patch);
      const settings = data as UserSettings;
      set({ settings });
      await setCache('settings', settings);
    } catch {
      // ignore
    } finally {
      set({ isSaving: false });
    }
  },

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    localStorage.setItem('workspace-ai-theme', theme);
    set({ theme, resolvedTheme: resolved });
  },
}));

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useSettingsStore.getState();
    if (state.theme === 'system') {
      const resolved = getSystemTheme();
      applyTheme(resolved);
      useSettingsStore.setState({ resolvedTheme: resolved });
    }
  });
}
