import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { TeamCard } from '@/components/teams/TeamCard';
import { CreateTeamModal } from '@/components/modals/CreateTeamModal';
import { useTeamStore } from '@/stores/team.store';

export function TeamsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { teams, isLoading, fetchTeams } = useTeamStore();

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Teams</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Organize your agents into collaborative teams.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          Create Team
        </button>
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-text-secondary">Loading teams...</p>
      )}

      <div className="space-y-3">
        {!isLoading && teams.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-text-secondary">No teams yet. Create your first team.</p>
          </div>
        )}
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>

      <CreateTeamModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
