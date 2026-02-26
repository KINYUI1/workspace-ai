import { useEffect, useState } from 'react';
import { Blocks, Power, PowerOff, Package, Wrench, Anchor, Terminal } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/services/api';

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  kind: 'tool' | 'channel' | 'memory' | 'hook';
  enabled: boolean;
  toolCount: number;
  hookCount: number;
  commandCount: number;
  path?: string;
}

const KIND_ICONS: Record<string, typeof Package> = {
  tool: Wrench,
  channel: Anchor,
  memory: Package,
  hook: Terminal,
};

const KIND_COLORS: Record<string, string> = {
  tool: 'text-blue-400 bg-blue-500/10',
  channel: 'text-green-400 bg-green-500/10',
  memory: 'text-purple-400 bg-purple-500/10',
  hook: 'text-amber-400 bg-amber-500/10',
};

export function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlugins = async () => {
    try {
      const res = await api.getPlugins();
      setPlugins((res as any).data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const togglePlugin = async (name: string, enable: boolean) => {
    try {
      if (enable) {
        await api.enablePlugin(name);
      } else {
        await api.disablePlugin(name);
      }
      setPlugins((prev) =>
        prev.map((p) => (p.name === name ? { ...p, enabled: enable } : p))
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Blocks className="h-5 w-5 text-text-secondary" />
          <h1 className="text-xl font-bold text-text-primary">Plugins</h1>
          <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
            {plugins.length}
          </span>
        </div>
      </div>

      <p className="text-sm text-text-secondary">
        Plugins extend Workspace AI with additional tools, channels, and hooks. Place plugins in{' '}
        <code className="rounded bg-surface-light px-1.5 py-0.5 text-xs text-primary-400">
          ~/.workspace-ai/plugins/
        </code>
      </p>

      {/* Plugin grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-5 h-40" />
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-16">
          <Blocks size={48} className="mb-4 text-text-secondary opacity-20" />
          <p className="text-sm text-text-secondary">No plugins installed</p>
          <p className="mt-1 text-xs text-text-secondary opacity-60">
            Add plugin directories to ~/.workspace-ai/plugins/ to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => {
            const KindIcon = KIND_ICONS[plugin.kind] || Package;
            return (
              <div
                key={plugin.name}
                className={clsx(
                  'rounded-xl border bg-surface p-5 transition-colors',
                  plugin.enabled ? 'border-border' : 'border-border/50 opacity-60',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('rounded-lg p-2', KIND_COLORS[plugin.kind])}>
                      <KindIcon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{plugin.name}</h3>
                      <p className="text-xs text-text-secondary">v{plugin.version}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => togglePlugin(plugin.name, !plugin.enabled)}
                    className={clsx(
                      'rounded-lg p-2 transition-colors',
                      plugin.enabled
                        ? 'text-green-400 hover:bg-green-500/10'
                        : 'text-text-secondary hover:bg-surface-light',
                    )}
                    title={plugin.enabled ? 'Disable' : 'Enable'}
                  >
                    {plugin.enabled ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                </div>

                {plugin.description && (
                  <p className="mt-3 text-xs text-text-secondary line-clamp-2">{plugin.description}</p>
                )}

                <div className="mt-4 flex items-center gap-3 text-xs text-text-secondary">
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase', KIND_COLORS[plugin.kind])}>
                    {plugin.kind}
                  </span>
                  {plugin.toolCount > 0 && <span>{plugin.toolCount} tools</span>}
                  {plugin.hookCount > 0 && <span>{plugin.hookCount} hooks</span>}
                  {plugin.commandCount > 0 && <span>{plugin.commandCount} commands</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
