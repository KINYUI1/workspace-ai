import { useEffect, useState } from 'react';
import { Radio, Plus, Trash2, Wifi, WifiOff, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useChannelStore, type ChannelAdapter } from '@/stores/channel.store';

const TYPE_COLORS: Record<string, string> = {
  telegram: 'text-blue-400 bg-blue-500/10',
  discord: 'text-indigo-400 bg-indigo-500/10',
  slack: 'text-green-400 bg-green-500/10',
  webhook: 'text-amber-400 bg-amber-500/10',
  email: 'text-red-400 bg-red-500/10',
  web: 'text-primary-400 bg-primary-500/10',
};

const STATUS_ICONS: Record<string, typeof Wifi> = {
  connected: Wifi,
  disconnected: WifiOff,
  error: AlertCircle,
};

export function ChannelsPage() {
  const { channels, catalog, fetchChannels, fetchCatalog, connectChannel, disconnectChannel } = useChannelStore();
  const [showSetup, setShowSetup] = useState<ChannelAdapter | null>(null);
  const [setupConfig, setSetupConfig] = useState<Record<string, string>>({});
  const [setupName, setSetupName] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchChannels();
    fetchCatalog();
  }, [fetchChannels, fetchCatalog]);

  const handleConnect = async () => {
    if (!showSetup || !setupName) return;
    setConnecting(true);
    try {
      await connectChannel(showSetup.type, setupName, setupConfig);
      setShowSetup(null);
      setSetupConfig({});
      setSetupName('');
    } catch {
      // ignore
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-text-secondary" />
        <h1 className="text-xl font-bold text-text-primary">Channels</h1>
        <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
          {channels.length} connected
        </span>
      </div>

      {/* Connected Channels */}
      {channels.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">Connected</h2>
          <div className="space-y-2">
            {channels.map((ch) => {
              const StatusIcon = STATUS_ICONS[ch.status] || WifiOff;
              return (
                <div key={ch.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <div className={clsx('rounded-lg p-2', TYPE_COLORS[ch.type] || 'text-text-secondary bg-surface-light')}>
                      <StatusIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{ch.name}</p>
                      <p className="text-xs text-text-secondary">{ch.type} &middot; {ch.status}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectChannel(ch.id)}
                    className="rounded-lg p-2 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel Catalog */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">Available Channels</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.map((adapter) => (
            <div key={adapter.type} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx('rounded-lg p-2', TYPE_COLORS[adapter.type] || 'text-text-secondary bg-surface-light')}>
                    <Radio size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{adapter.displayName}</h3>
                  </div>
                </div>
                <button
                  onClick={() => { setShowSetup(adapter); setSetupName(`My ${adapter.displayName}`); setSetupConfig({}); }}
                  className="rounded-lg bg-primary-600 p-2 text-white hover:bg-primary-700"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="mt-3 text-xs text-text-secondary">{adapter.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup Modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">Connect {showSetup.displayName}</h3>
              <button onClick={() => setShowSetup(null)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Channel Name</label>
                <input
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
                />
              </div>

              {showSetup.configSchema.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                    value={setupConfig[field.key] || ''}
                    onChange={(e) => setSetupConfig({ ...setupConfig, [field.key]: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
                  />
                  {field.description && (
                    <p className="mt-1 text-xs text-text-secondary">{field.description}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowSetup(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting || !setupName}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
