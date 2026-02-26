import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { AgentCard } from '@/components/agents/AgentCard';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CreateAgentModal } from '@/components/modals/CreateAgentModal';
import { useTeamStore } from '@/stores/team.store';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showAddAgent, setShowAddAgent] = useState(false);
  const { selectedTeam, isLoading, fetchTeam, deleteTeam, clearSelectedTeam } = useTeamStore();

  useEffect(() => {
    if (id) fetchTeam(id);
    return () => clearSelectedTeam();
  }, [id, fetchTeam, clearSelectedTeam]);

  if (isLoading || !selectedTeam) {
    return (
      <div className="py-16 text-center text-sm text-text-secondary">
        {isLoading ? 'Loading team...' : 'Team not found'}
      </div>
    );
  }

  const agents = selectedTeam.agents ?? [];
  const busyCount = agents.filter((a) => a.status === 'busy').length;
  const teamProgress = agents.length
    ? Math.round(agents.reduce((sum, a) => sum + a.stats.tasksCompleted, 0) / agents.length)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/teams"
          className="mb-3 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back to Teams
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary">{selectedTeam.name}</h1>
              <StatusBadge status={selectedTeam.status} size="md" />
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {selectedTeam.goal || selectedTeam.description || 'No goal set'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddAgent(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus size={14} />
              Add Agent
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this team? Agents will be unassigned.')) {
                  deleteTeam(selectedTeam.id);
                }
              }}
              className="rounded-lg border border-border p-2 text-text-secondary hover:bg-red-600/10 hover:text-red-400"
              aria-label="Delete team"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-text-secondary">No agents in this team yet.</p>
          </div>
        )}
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Team Progress */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Team Stats</h3>
        <div className="mb-3 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-text-primary">{agents.length}</p>
            <p className="text-xs text-text-secondary">Agents</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-status-busy">{busyCount}</p>
            <p className="text-xs text-text-secondary">Working</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-400">{teamProgress}</p>
            <p className="text-xs text-text-secondary">Tasks Done</p>
          </div>
        </div>
        <ProgressBar value={agents.length ? 75 : 0} size="md" />
      </div>

      <CreateAgentModal
        open={showAddAgent}
        onClose={() => {
          setShowAddAgent(false);
          if (id) fetchTeam(id);
        }}
        teamId={id}
      />
    </div>
  );
}
