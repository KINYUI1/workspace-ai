import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Users, ChevronRight } from 'lucide-react';
import type { Team } from '@/types';

interface TeamCardProps {
  team: Team & { agentCount?: number };
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <Link
      to={`/teams/${team.id}`}
      className="group flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary-600/40 hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/15 text-primary-400">
          <Users size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary">{team.name}</h3>
            <StatusBadge status={team.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">
            {team.goal || team.description || 'No goal set'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">{team.agentCount ?? 0} agents</span>
        <ChevronRight
          size={18}
          className="text-text-secondary transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
