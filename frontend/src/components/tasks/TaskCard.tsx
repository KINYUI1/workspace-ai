import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Clock, Trash2, Users, Bot } from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '@/types';

const AGENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-green-500',
  busy: 'bg-amber-500',
  error: 'bg-red-500',
  offline: 'bg-gray-500',
};

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onDelete?: () => void;
}

export function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const deadlineStr = task.deadline
    ? new Date(task.deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const isOverdue =
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== 'completed';

  const agents = task.assignedAgents ?? [];
  const visibleAgents = agents.slice(0, 3);
  const overflowCount = agents.length - visibleAgents.length;

  return (
    <div
      className="group cursor-pointer rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary-600/30"
      onClick={onClick}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <PriorityBadge priority={task.priority} />
          <h3 className="text-sm font-medium text-text-primary line-clamp-1">{task.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-lg p-1 text-text-secondary opacity-0 transition-opacity hover:bg-surface-light hover:text-red-400 group-hover:opacity-100"
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          )}
          <StatusBadge status={task.status} />
        </div>
      </div>

      {task.description && (
        <p className="mb-3 text-xs text-text-secondary line-clamp-2">{task.description}</p>
      )}

      {/* Team & Agents */}
      {(task.teamName || agents.length > 0) && (
        <div className="mb-3 flex items-center gap-3">
          {task.teamName && (
            <span className="flex items-center gap-1 rounded-md bg-primary-600/10 px-2 py-0.5 text-[11px] font-medium text-primary-400">
              <Users size={10} />
              {task.teamName}
            </span>
          )}
          {agents.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {visibleAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary-600/20"
                  title={`${agent.name} · ${agent.role} · ${agent.status}`}
                >
                  <Bot size={10} className="text-primary-400" />
                  <span
                    className={clsx(
                      'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface',
                      AGENT_STATUS_COLORS[agent.status] || 'bg-gray-500',
                    )}
                  />
                </div>
              ))}
              {overflowCount > 0 && (
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-light text-[9px] font-semibold text-text-secondary"
                  title={agents.slice(3).map((a) => a.name).join(', ')}
                >
                  +{overflowCount}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ProgressBar value={task.progress} className="mb-3" />

      <div className="flex items-center justify-between text-xs text-text-secondary">
        {deadlineStr && (
          <span
            className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-medium' : ''}`}
          >
            <Clock size={12} />
            {deadlineStr}
            {isOverdue && ' (overdue)'}
          </span>
        )}
        <span className="ml-auto">
          Created{' '}
          {new Date(task.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}
