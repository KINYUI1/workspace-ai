import { useState, useRef, useEffect } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import {
  MoreVertical,
  Trash2,
  Edit3,
  Users,
  Brain,
  Clock,
  Cpu,
  Power,
  PowerOff,
  MessageSquare,
} from 'lucide-react';
import type { Agent } from '@/types';

interface AgentCardProps {
  agent: Agent & { teamName?: string };
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
}

export function AgentCard({ agent, onClick, onEdit, onDelete, onToggleStatus }: AgentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const lastActiveText = agent.lastActive
    ? new Date(agent.lastActive).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  const modelLabel =
    agent.modelProvider === 'ollama'
      ? `Ollama${agent.modelName ? ` (${agent.modelName})` : ''}`
      : 'Claude';

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary-600/40 hover:shadow-lg"
      onClick={onClick}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <StatusBadge status={agent.status} size="md" />
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-text-primary">{agent.name}</h3>
            <p className="text-xs text-text-secondary">{agent.role}</p>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative" ref={menuRef}>
          <button
            className="rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-surface-light group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="Agent options"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-border bg-surface py-1 shadow-xl">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-light"
                >
                  <Edit3 size={14} />
                  Edit Agent
                </button>
              )}
              {onToggleStatus && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onToggleStatus();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-light"
                >
                  {agent.status === 'offline' ? <Power size={14} /> : <PowerOff size={14} />}
                  {agent.status === 'offline' ? 'Activate' : 'Deactivate'}
                </button>
              )}
              {onDelete && !agent.isMainAgent && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                    Delete Agent
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Team badge */}
      {(agent as Agent & { teamName?: string }).teamName && (
        <div className="mb-2.5 flex items-center gap-1.5">
          <Users size={12} className="text-green-400" />
          <span className="text-xs text-text-secondary">
            {(agent as Agent & { teamName?: string }).teamName}
          </span>
        </div>
      )}

      {/* Personality snippet */}
      {agent.personality && (
        <div className="mb-2.5 flex items-start gap-1.5">
          <MessageSquare size={12} className="mt-0.5 shrink-0 text-purple-400" />
          <p className="line-clamp-2 text-xs text-text-secondary italic">
            {agent.personality}
          </p>
        </div>
      )}

      {/* Current Activity */}
      {agent.currentTaskId && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-text-secondary">Current task</p>
          <ProgressBar value={agent.stats.tasksCompleted > 0 ? 65 : 0} />
        </div>
      )}

      {/* Specialties */}
      {agent.specialty.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {agent.specialty.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded bg-primary-600/10 px-1.5 py-0.5 text-xs text-primary-400"
            >
              {s}
            </span>
          ))}
          {agent.specialty.length > 3 && (
            <span className="rounded bg-surface-light px-1.5 py-0.5 text-xs text-text-secondary">
              +{agent.specialty.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Info row: model + last active */}
      <div className="mb-3 flex items-center gap-3 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Cpu size={11} />
          {modelLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {lastActiveText}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Brain size={11} />
          {agent.stats.tasksCompleted} tasks
        </span>
        <span>{agent.stats.successRate}% rate</span>
        <span>{agent.stats.messagesProcessed} msgs</span>
        {agent.isMainAgent && (
          <span className="ml-auto rounded bg-primary-600/20 px-1.5 py-0.5 text-primary-300">
            Main
          </span>
        )}
      </div>
    </div>
  );
}
