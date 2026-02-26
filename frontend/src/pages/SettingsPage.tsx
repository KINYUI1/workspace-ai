import { useState, useEffect } from 'react';
import { Settings, Globe, Bot, User, Monitor, HardDrive, Database } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

const isDesktop = !!(window as any).electronAPI?.isDesktop;

const baseTabs = [
  { key: 'integrations', label: 'Integrations', icon: Globe },
  { key: 'models', label: 'Models', icon: Bot },
  { key: 'profile', label: 'Profile', icon: User },
] as const;

const desktopTabs = [
  { key: 'integrations', label: 'Integrations', icon: Globe },
  { key: 'models', label: 'Models', icon: Bot },
  { key: 'desktop', label: 'Desktop', icon: Monitor },
  { key: 'profile', label: 'Profile', icon: User },
] as const;

type TabKey = 'integrations' | 'models' | 'profile' | 'desktop';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('integrations');
  const { user } = useAuthStore();
  const { settings, isLoading, isSaving, fetchSettings, updateSettings } =
    useSettingsStore();

  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [braveApiKey, setBraveApiKey] = useState('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');

  // Desktop-specific state
  const [desktopConfig, setDesktopConfig] = useState<any>(null);

  const tabs = isDesktop ? desktopTabs : baseTabs;

  useEffect(() => {
    fetchSettings();
    if (isDesktop) {
      (window as any).electronAPI.getConfig().then((config: any) => {
        setDesktopConfig(config);
      });
    }
  }, [fetchSettings]);

  useEffect(() => {
    setSlackWebhookUrl(settings.slackWebhookUrl ?? '');
    setDiscordWebhookUrl(settings.discordWebhookUrl ?? '');
    setBraveApiKey(settings.braveApiKey ?? '');
    setOllamaBaseUrl(settings.ollamaBaseUrl ?? 'http://localhost:11434');
  }, [settings]);

  const handleSaveIntegrations = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ slackWebhookUrl, discordWebhookUrl, braveApiKey });
  };

  const handleSaveModels = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ ollamaBaseUrl });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-text-secondary" />
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabKey)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary-600/15 text-primary-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-sm text-text-secondary">Loading settings...</div>
      ) : (
        <>
          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <form onSubmit={handleSaveIntegrations}>
              <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Slack Webhook URL
                  </label>
                  <input
                    type="text"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Incoming webhook URL for sending notifications to a Slack
                    channel.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Discord Webhook URL
                  </label>
                  <input
                    type="text"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Webhook URL for sending notifications to a Discord channel.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Brave Search API Key
                  </label>
                  <input
                    type="password"
                    value={braveApiKey}
                    onChange={(e) => setBraveApiKey(e.target.value)}
                    placeholder="BSA..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    API key for Brave Search, used by agents with web-search
                    capabilities.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && (
            <form onSubmit={handleSaveModels}>
              <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Ollama Base URL
                  </label>
                  <input
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Configure local AI model server for agents using Ollama
                    provider.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Desktop Tab (only visible in Electron) */}
          {activeTab === 'desktop' && isDesktop && desktopConfig && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Desktop Configuration
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="h-4 w-4 text-text-secondary" />
                      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                        Data Directory
                      </span>
                    </div>
                    <p className="text-sm text-text-primary font-mono truncate">
                      {desktopConfig.dataDir}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-text-secondary" />
                      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                        Database
                      </span>
                    </div>
                    <p className="text-sm text-text-primary font-mono truncate">
                      {desktopConfig.dbPath}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                      LLM Provider
                    </span>
                    <p className="text-sm text-text-primary mt-1 capitalize">
                      {desktopConfig.llm?.provider || 'anthropic'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                      Server Port
                    </span>
                    <p className="text-sm text-text-primary mt-1">
                      {desktopConfig.server?.port || 3333}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                      Anthropic API Key
                    </span>
                    <p className="text-sm mt-1">
                      {desktopConfig.llm?.hasAnthropicKey ? (
                        <span className="text-green-400">Configured</span>
                      ) : (
                        <span className="text-amber-400">Not set</span>
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                      Ollama URL
                    </span>
                    <p className="text-sm text-text-primary mt-1 font-mono truncate">
                      {desktopConfig.llm?.ollamaBaseUrl || 'http://localhost:11434'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-text-secondary">
                  Desktop configuration is stored in{' '}
                  <span className="font-mono">~/.workspace-ai/config.json</span>.
                  Edit the file directly to change API keys and advanced settings,
                  then restart the app.
                </p>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={user?.name ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none opacity-70 cursor-default"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Email
                </label>
                <input
                  type="text"
                  value={user?.email ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none opacity-70 cursor-default"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
