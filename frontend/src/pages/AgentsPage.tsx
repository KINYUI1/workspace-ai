import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AgentCard } from '@/components/agents/AgentCard';
import { CreateAgentModal } from '@/components/modals/CreateAgentModal';
import { EditAgentModal } from '@/components/modals/EditAgentModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAgentStore } from '@/stores/agent.store';
import { useTeamStore } from '@/stores/team.store';
import type { Agent } from '@/types';

type StatusFilter = 'all' | 'active' | 'idle' | 'busy' | 'offline' | 'error';

export function AgentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { agents, isLoading, fetchAgents, deleteAgent: removeAgent, updateAgent } = useAgentStore();
  const { fetchTeams } = useTeamStore();

  useEffect(() => {
    fetchAgents();
    fetchTeams();
  }, [fetchAgents, fetchTeams]);

  const handleDelete = async () => {
    if (!deleteAgent) return;
    setIsDeleting(true);
    try {
      await removeAgent(deleteAgent.id);
      setDeleteAgent(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'offline' ? 'idle' : 'offline';
    await updateAgent(agent.id, { status: newStatus });
  };

  const mainAgent = agents.find((a) => a.isMainAgent);
  const teamAgents = agents.filter((a) => !a.isMainAgent);

  // Apply filters
  const filtered = teamAgents.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const teamName = ((a as Agent & { teamName?: string }).teamName ?? '').toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.specialty.some((s) => s.toLowerCase().includes(q)) ||
        teamName.includes(q)
      );
    }
    return true;
  });

  const statusCounts = {
    all: teamAgents.length,
    active: teamAgents.filter((a) => a.status === 'active').length,
    idle: teamAgents.filter((a) => a.status === 'idle').length,
    busy: teamAgents.filter((a) => a.status === 'busy').length,
    offline: teamAgents.filter((a) => a.status === 'offline').length,
    error: teamAgents.filter((a) => a.status === 'error').length,
  };

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'busy', label: 'Busy' },
    { value: 'idle', label: 'Idle' },
    { value: 'offline', label: 'Offline' },
    { value: 'error', label: 'Error' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Agents</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} in your workspace.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          Create Agent
        </button>
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-text-secondary">Loading agents...</p>
      )}

      {/* Main Agent */}
      {mainAgent && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Main Agent
          </h2>
          <div className="max-w-sm">
            <AgentCard
              agent={mainAgent}
              onEdit={() => setEditAgent(mainAgent)}
            />
          </div>
        </div>
      )}

      {/* Team Agents */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">
          Team Agents ({teamAgents.length})
        </h2>

        {/* Search & Filters */}
        {teamAgents.length > 0 && (
          <div className="mb-4 space-y-3">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, role, specialty, or team..."
                className="w-full rounded-lg border border-border bg-bg pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                    statusFilter === f.value
                      ? 'border-primary-500 bg-primary-600/15 text-primary-400'
                      : 'border-border text-text-secondary hover:bg-surface-light'
                  }`}
                >
                  {f.label}
                  {statusCounts[f.value] > 0 && (
                    <span className="ml-1 text-text-secondary/60">{statusCounts[f.value]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full rounded-xl border border-dashed border-border py-12 text-center">
              <p className="text-sm text-text-secondary">
                {search || statusFilter !== 'all'
                  ? 'No agents match your filters.'
                  : 'No team agents yet. Create one to get started.'}
              </p>
            </div>
          )}
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => setEditAgent(agent)}
              onDelete={() => setDeleteAgent(agent)}
              onToggleStatus={() => handleToggleStatus(agent)}
            />
          ))}
        </div>
      </div>

      <CreateAgentModal open={showCreate} onClose={() => setShowCreate(false)} />
      <EditAgentModal open={!!editAgent} onClose={() => setEditAgent(null)} agent={editAgent} />
      <ConfirmDialog
        open={!!deleteAgent}
        onClose={() => setDeleteAgent(null)}
        onConfirm={handleDelete}
        title="Delete Agent"
        message={`Are you sure you want to delete "${deleteAgent?.name}"? This will remove all associated data including permissions, memories, and task history. This action cannot be undone.`}
        confirmLabel="Delete Agent"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
