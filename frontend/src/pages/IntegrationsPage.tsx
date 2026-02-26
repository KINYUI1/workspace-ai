import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogos';
import {
  Plug,
  Search,
  ExternalLink,
  Check,
  X,
  Loader2,
  MessageSquare,
  FolderGit2,
  HardDrive,
  Kanban,
  BarChart3,
  Users,
  Shield,
  Clock,
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  History,
  Terminal,
  HelpCircle,
} from 'lucide-react';

// --- Types ---

interface Integration {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  iconUrl: string | null;
  website: string | null;
  authType: string;
  actions: { name: string; label: string; description: string }[];
  isActive: boolean;
  createdAt: string;
}

interface UserConnection {
  id: string;
  userId: string;
  integrationId: string;
  status: string;
  config: Record<string, unknown>;
  connectedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  integration?: Integration;
}

interface LogEntry {
  id: string;
  action: string;
  status: string;
  errorMessage: string | null;
  executionTimeMs: number | null;
  createdAt: string;
}

// --- Constants ---

const CATEGORIES = [
  { value: '', label: 'All Apps', icon: Zap },
  { value: 'communication', label: 'Communication', icon: MessageSquare },
  { value: 'project_management', label: 'Project Management', icon: Kanban },
  { value: 'development', label: 'Development', icon: FolderGit2 },
  { value: 'storage', label: 'Cloud Storage', icon: HardDrive },
  { value: 'crm', label: 'CRM', icon: Users },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-500/20 text-blue-400',
  project_management: 'bg-purple-500/20 text-purple-400',
  development: 'bg-green-500/20 text-green-400',
  storage: 'bg-amber-500/20 text-amber-400',
  crm: 'bg-pink-500/20 text-pink-400',
  analytics: 'bg-cyan-500/20 text-cyan-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Communication',
  project_management: 'Project Management',
  development: 'Development',
  storage: 'Cloud Storage',
  crm: 'CRM',
  analytics: 'Analytics',
};

// Per-integration credential configuration
const CREDENTIAL_CONFIG: Record<string, {
  fields: { key: string; label: string; type: 'text' | 'password'; placeholder: string }[];
  helpUrl: string;
  helpText: string;
}> = {
  github: {
    fields: [{ key: 'accessToken', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx' }],
    helpUrl: 'https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=Workspace%20AI',
    helpText: 'Generate a token with repo, read:user, and user:email scopes',
  },
  slack: {
    fields: [{ key: 'accessToken', label: 'Bot User OAuth Token', type: 'password', placeholder: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx' }],
    helpUrl: 'https://api.slack.com/apps',
    helpText: 'Create a Slack App, add Bot Token Scopes, then install to your workspace',
  },
  'google-drive': {
    fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password', placeholder: 'ya29.xxxxxxx' }],
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    helpText: 'Create OAuth 2.0 credentials in Google Cloud Console',
  },
  gmail: {
    fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password', placeholder: 'ya29.xxxxxxx' }],
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    helpText: 'Enable Gmail API and create OAuth 2.0 credentials',
  },
  'google-calendar': {
    fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password', placeholder: 'ya29.xxxxxxx' }],
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    helpText: 'Enable Calendar API and create OAuth 2.0 credentials',
  },
  'google-analytics': {
    fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password', placeholder: 'ya29.xxxxxxx' }],
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    helpText: 'Enable Analytics API and create OAuth 2.0 credentials',
  },
  jira: {
    fields: [
      { key: 'domain', label: 'Jira Domain', type: 'text', placeholder: 'your-company.atlassian.net' },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'you@company.com' },
      { key: 'apiKey', label: 'API Token', type: 'password', placeholder: 'ATATT3xFfGF0...' },
    ],
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    helpText: 'Create an API token from your Atlassian account',
  },
  notion: {
    fields: [{ key: 'accessToken', label: 'Integration Token', type: 'password', placeholder: 'ntn_xxxxxxxxxxxxxxxxxxxx' }],
    helpUrl: 'https://www.notion.so/my-integrations',
    helpText: 'Create an internal integration and copy the token',
  },
  trello: {
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    ],
    helpUrl: 'https://trello.com/power-ups/admin',
    helpText: 'Get your API key and generate a token from the Trello Developer Portal',
  },
  'microsoft-teams': {
    fields: [{ key: 'accessToken', label: 'Bot Access Token', type: 'password', placeholder: 'eyJ0eXAiOiJKV1...' }],
    helpUrl: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    helpText: 'Register an app in Azure AD with Teams permissions',
  },
  salesforce: {
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', type: 'text', placeholder: 'https://your-org.salesforce.com' },
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: '00Dxxxxxxxxx!xxxxxxxxx' },
    ],
    helpUrl: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_create_api_integration.htm',
    helpText: 'Create a Connected App and use OAuth to get an access token',
  },
  hubspot: {
    fields: [{ key: 'accessToken', label: 'Private App Token', type: 'password', placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx' }],
    helpUrl: 'https://app.hubspot.com/private-apps/',
    helpText: 'Create a Private App with the required scopes',
  },
  dropbox: {
    fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'sl.xxxxxxxxxxxxxxxx' }],
    helpUrl: 'https://www.dropbox.com/developers/apps',
    helpText: 'Create an app and generate an access token',
  },
  linear: {
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'lin_api_xxxxxxxxxxxxxxxxxxxxxxxxx' }],
    helpUrl: 'https://linear.app/settings/api',
    helpText: 'Generate a personal API key from Linear Settings',
  },
  figma: {
    fields: [{ key: 'accessToken', label: 'Personal Access Token', type: 'password', placeholder: 'figd_xxxxxxxxxxxxxxxxxxxxxxxxx' }],
    helpUrl: 'https://www.figma.com/developers/api#access-tokens',
    helpText: 'Generate a personal access token from Figma Settings',
  },
};

// --- Main Component ---

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConnectModal, setShowConnectModal] = useState<Integration | null>(null);
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});

  // Action execution state
  const [activeAction, setActiveAction] = useState<{ integrationId: string; actionName: string } | null>(null);
  const [actionInput, setActionInput] = useState('{}');
  const [actionResult, setActionResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [actionRunning, setActionRunning] = useState(false);

  // Connection test state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  // Logs state
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [intgRes, connRes] = await Promise.all([
        api.getIntegrations(),
        api.getUserIntegrationConnections(),
      ]);
      setIntegrations((intgRes.data ?? []) as Integration[]);
      setConnections((connRes.data ?? []) as UserConnection[]);
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for OAuth popup callback
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-callback' && event.data?.success) {
        fetchData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchData]);

  const connectedMap = new Map(
    connections.filter((c) => c.status === 'connected').map((c) => [c.integrationId, c]),
  );

  const handleConnect = async (integration: Integration) => {
    // Try OAuth first if configured
    if (integration.authType === 'oauth2') {
      setConnectingId(integration.id);
      try {
        const res = await api.getOAuthAuthorizeUrl(integration.slug);
        const url = (res.data as { authorizationUrl: string })?.authorizationUrl;
        if (url) {
          const w = 600, h = 700;
          const left = window.screenX + (window.innerWidth - w) / 2;
          const top = window.screenY + (window.innerHeight - h) / 2;
          window.open(url, 'oauth', `width=${w},height=${h},left=${left},top=${top}`);
          setConnectingId(null);
          return;
        }
      } catch {
        // OAuth not configured on server — fall through to manual credential entry
      }
      setConnectingId(null);
    }

    // Show credential modal for manual connection
    setShowConnectModal(integration);
    setCredentialInputs({});
  };

  const handleCredentialConnect = async () => {
    if (!showConnectModal) return;
    const config = CREDENTIAL_CONFIG[showConnectModal.slug];
    if (config) {
      const allFilled = config.fields.every((f) => credentialInputs[f.key]?.trim());
      if (!allFilled) return;
    }

    setConnectingId(showConnectModal.id);
    try {
      const creds: Record<string, unknown> = {};
      Object.entries(credentialInputs).forEach(([k, v]) => { creds[k] = v.trim(); });
      await api.connectIntegration(showConnectModal.id, creds);
      await fetchData();
      setShowConnectModal(null);
      setCredentialInputs({});
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setDisconnectingId(integrationId);
    try {
      await api.disconnectIntegration(integrationId);
      await fetchData();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    setTestingId(integrationId);
    setTestResult(null);
    try {
      const res = await api.testIntegrationConnection(integrationId);
      setTestResult(res.data as { valid: boolean; error?: string });
    } catch (err) {
      setTestResult({ valid: false, error: (err as Error).message });
    } finally {
      setTestingId(null);
    }
  };

  const handleExecuteAction = async () => {
    if (!activeAction) return;
    setActionRunning(true);
    setActionResult(null);
    try {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(actionInput);
      } catch {
        setActionResult({ success: false, error: 'Invalid JSON input' });
        setActionRunning(false);
        return;
      }
      const res = await api.executeIntegrationAction(activeAction.integrationId, activeAction.actionName, input);
      setActionResult(res.data as { success: boolean; data?: unknown; error?: string });
    } catch (err) {
      setActionResult({ success: false, error: (err as Error).message });
    } finally {
      setActionRunning(false);
    }
  };

  const handleShowLogs = async (integrationId: string) => {
    setShowLogs(integrationId);
    setLogsLoading(true);
    try {
      const res = await api.getIntegrationLogs(integrationId, 20);
      setLogs((res.data ?? []) as LogEntry[]);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const filtered = integrations.filter((i) => {
    const matchesSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || i.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20">
              <Plug size={20} className="text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Integrations</h1>
              <p className="text-sm text-text-secondary">
                {connectedCount} connected &middot; {integrations.length} available
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-light py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-secondary focus:border-primary-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto">
          {CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveCategory(value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === value
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Plug size={40} className="mb-3 opacity-40" />
            <p className="text-sm">No integrations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((integration) => {
              const isConnected = connectedMap.has(integration.id);
              const connection = connectedMap.get(integration.id);
              const isConnecting = connectingId === integration.id;
              const isDisconnecting = disconnectingId === integration.id;

              return (
                <div
                  key={integration.id}
                  className={`group relative flex flex-col rounded-xl border p-4 transition-all hover:shadow-lg cursor-pointer ${
                    isConnected
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-border bg-surface hover:border-border-light'
                  }`}
                  onClick={() => setSelectedIntegration(integration)}
                >
                  {isConnected && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                      <Check size={12} />
                      Connected
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <IntegrationLogo slug={integration.slug} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text-primary">{integration.name}</h3>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[integration.category] || 'bg-gray-500/20 text-gray-400'}`}>
                        {CATEGORY_LABELS[integration.category] || integration.category}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 flex-1 text-xs leading-relaxed text-text-secondary line-clamp-2">
                    {integration.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-text-secondary">
                      {integration.actions.length} action{integration.actions.length !== 1 ? 's' : ''}
                    </span>

                    {isConnected ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDisconnect(integration.id); }}
                        disabled={isDisconnecting}
                        className="rounded-lg border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {isDisconnecting ? <Loader2 size={12} className="animate-spin" /> : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleConnect(integration); }}
                        disabled={isConnecting}
                        className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
                      >
                        {isConnecting ? <Loader2 size={12} className="animate-spin" /> : 'Connect'}
                      </button>
                    )}
                  </div>

                  {connection && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-text-secondary">
                      <Clock size={10} />
                      Connected {new Date(connection.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedIntegration && (
        <DetailPanel
          integration={selectedIntegration}
          connection={connectedMap.get(selectedIntegration.id)}
          connectingId={connectingId}
          testingId={testingId}
          testResult={testResult}
          activeAction={activeAction}
          actionInput={actionInput}
          actionResult={actionResult}
          actionRunning={actionRunning}
          showLogs={showLogs}
          logs={logs}
          logsLoading={logsLoading}
          onClose={() => {
            setSelectedIntegration(null);
            setActiveAction(null);
            setActionResult(null);
            setTestResult(null);
            setShowLogs(null);
          }}
          onConnect={() => handleConnect(selectedIntegration)}
          onDisconnect={() => { handleDisconnect(selectedIntegration.id); setSelectedIntegration(null); }}
          onTestConnection={() => handleTestConnection(selectedIntegration.id)}
          onSelectAction={(actionName) => {
            setActiveAction({ integrationId: selectedIntegration.id, actionName });
            setActionInput('{}');
            setActionResult(null);
          }}
          onActionInputChange={setActionInput}
          onExecuteAction={handleExecuteAction}
          onShowLogs={() => handleShowLogs(selectedIntegration.id)}
          onCloseLogs={() => setShowLogs(null)}
        />
      )}

      {/* Credential Connect Modal */}
      {showConnectModal && (() => {
        const config = CREDENTIAL_CONFIG[showConnectModal.slug];
        const fields = config?.fields ?? [{ key: 'apiKey', label: 'API Key', type: 'password' as const, placeholder: 'Enter your API key...' }];
        const allFilled = fields.every((f) => credentialInputs[f.key]?.trim());

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowConnectModal(null); setCredentialInputs({}); }}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <IntegrationLogo slug={showConnectModal.slug} />
                <div>
                  <h2 className="text-base font-bold text-text-primary">Connect {showConnectModal.name}</h2>
                  <p className="text-xs text-text-secondary">
                    {config?.helpText || 'Enter your credentials to connect'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">{field.label}</label>
                    <input
                      type={field.type}
                      value={credentialInputs[field.key] || ''}
                      onChange={(e) => setCredentialInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-primary-500 focus:outline-none"
                      autoFocus={fields.indexOf(field) === 0}
                      onKeyDown={(e) => e.key === 'Enter' && allFilled && handleCredentialConnect()}
                    />
                  </div>
                ))}
              </div>

              {config?.helpUrl && (
                <a
                  href={config.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300"
                >
                  <HelpCircle size={12} />
                  How to get your credentials
                  <ExternalLink size={10} />
                </a>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setShowConnectModal(null); setCredentialInputs({}); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCredentialConnect}
                  disabled={!allFilled || connectingId === showConnectModal.id}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
                >
                  {connectingId === showConnectModal.id ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// --- Detail Panel ---

function DetailPanel({
  integration,
  connection,
  connectingId,
  testingId,
  testResult,
  activeAction,
  actionInput,
  actionResult,
  actionRunning,
  showLogs,
  logs,
  logsLoading,
  onClose,
  onConnect,
  onDisconnect,
  onTestConnection,
  onSelectAction,
  onActionInputChange,
  onExecuteAction,
  onShowLogs,
  onCloseLogs,
}: {
  integration: Integration;
  connection?: UserConnection;
  connectingId: string | null;
  testingId: string | null;
  testResult: { valid: boolean; error?: string } | null;
  activeAction: { integrationId: string; actionName: string } | null;
  actionInput: string;
  actionResult: { success: boolean; data?: unknown; error?: string } | null;
  actionRunning: boolean;
  showLogs: string | null;
  logs: LogEntry[];
  logsLoading: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onTestConnection: () => void;
  onSelectAction: (actionName: string) => void;
  onActionInputChange: (val: string) => void;
  onExecuteAction: () => void;
  onShowLogs: () => void;
  onCloseLogs: () => void;
}) {
  const isConnected = connection?.status === 'connected';
  const selectedAction = integration.actions.find((a) => a.name === activeAction?.actionName);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-xl overflow-y-auto bg-background border-l border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <div className="flex items-center gap-3">
            <IntegrationLogo slug={integration.slug} />
            <div>
              <h2 className="text-lg font-bold text-text-primary">{integration.name}</h2>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[integration.category] || 'bg-gray-500/20 text-gray-400'}`}>
                {CATEGORY_LABELS[integration.category] || integration.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">About</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{integration.description}</p>
          </div>

          {/* Auth type & website */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-light px-3 py-2">
              <Shield size={14} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary capitalize">{integration.authType.replace('_', ' ')}</span>
              </span>
            </div>
            {integration.website && (
              <a href={integration.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300">
                <ExternalLink size={12} />
                Website
              </a>
            )}
          </div>

          {/* Connection status */}
          {isConnected && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-sm font-medium text-green-400">Connected</span>
                  <span className="text-xs text-text-secondary">
                    since {new Date(connection!.connectedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onTestConnection}
                  disabled={testingId === integration.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-light disabled:opacity-50"
                >
                  {testingId === integration.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Test Connection
                </button>
                <button
                  onClick={onShowLogs}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-light"
                >
                  <History size={12} />
                  View Logs
                </button>
                <button
                  onClick={onDisconnect}
                  className="ml-auto rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
                >
                  Disconnect
                </button>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${testResult.valid ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {testResult.valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {testResult.valid ? 'Connection is healthy' : testResult.error || 'Connection test failed'}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Zap size={14} />
              {isConnected ? 'Run Actions' : 'Available Actions'}
            </h3>
            <div className="space-y-2">
              {integration.actions.map((action) => {
                const isActive = activeAction?.actionName === action.name;
                return (
                  <div key={action.name}>
                    <button
                      onClick={() => isConnected ? onSelectAction(isActive ? '' : action.name) : undefined}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'border-primary-500/50 bg-primary-500/10'
                          : isConnected
                            ? 'border-border bg-surface hover:border-primary-500/30 cursor-pointer'
                            : 'border-border bg-surface opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                            {action.label}
                            {isConnected && <Play size={10} className="text-primary-400" />}
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5">{action.description}</div>
                        </div>
                        {isConnected && <ChevronRight size={14} className={`text-text-secondary transition-transform ${isActive ? 'rotate-90' : ''}`} />}
                      </div>
                    </button>

                    {/* Action execution panel */}
                    {isActive && selectedAction && (
                      <div className="mt-2 rounded-lg border border-border bg-surface-light p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Terminal size={12} />
                          Input (JSON)
                        </div>
                        <textarea
                          value={actionInput}
                          onChange={(e) => onActionInputChange(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-text-primary placeholder-text-secondary focus:border-primary-500 focus:outline-none resize-none"
                          placeholder='{ "owner": "user", "repo": "repo-name" }'
                        />
                        <button
                          onClick={onExecuteAction}
                          disabled={actionRunning}
                          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50"
                        >
                          {actionRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                          {actionRunning ? 'Running...' : 'Execute'}
                        </button>

                        {/* Action result */}
                        {actionResult && (
                          <div className={`rounded-lg border p-3 ${actionResult.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {actionResult.success ? (
                                <CheckCircle2 size={14} className="text-green-400" />
                              ) : (
                                <XCircle size={14} className="text-red-400" />
                              )}
                              <span className={`text-xs font-medium ${actionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                {actionResult.success ? 'Success' : 'Error'}
                              </span>
                            </div>
                            <pre className="overflow-x-auto rounded bg-background p-2 text-xs font-mono text-text-secondary max-h-48 overflow-y-auto">
                              {actionResult.error
                                ? actionResult.error
                                : JSON.stringify(actionResult.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logs panel */}
          {showLogs === integration.id && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <History size={14} />
                  Recent Activity
                </h3>
                <button onClick={onCloseLogs} className="text-xs text-text-secondary hover:text-text-primary">Close</button>
              </div>
              {logsLoading ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-text-secondary" /></div>
              ) : logs.length === 0 ? (
                <p className="text-xs text-text-secondary italic py-4 text-center">No activity yet</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      {log.status === 'success' ? (
                        <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                      ) : (
                        <XCircle size={12} className="text-red-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-text-primary">{log.action}</span>
                      {log.executionTimeMs != null && (
                        <span className="text-[10px] text-text-secondary">{log.executionTimeMs}ms</span>
                      )}
                      <span className="ml-auto text-[10px] text-text-secondary">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Connect button for non-connected */}
          {!isConnected && (
            <div className="border-t border-border pt-4">
              <button
                onClick={onConnect}
                disabled={connectingId === integration.id}
                className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
              >
                {connectingId === integration.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  'Connect Integration'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
