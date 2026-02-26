import { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useTaskStore } from '@/stores/task.store';
import { Bot, Users } from 'lucide-react';
import { clsx } from 'clsx';
import type { Task, TaskPriority, TaskStatus } from '@/types';

interface EditTaskModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
}

const priorities: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
const statuses: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed', 'failed'];

const AGENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-green-500',
  busy: 'bg-amber-500',
  error: 'bg-red-500',
  offline: 'bg-gray-500',
};

export function EditTaskModal({ open, onClose, task }: EditTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [deadline, setDeadline] = useState('');
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateTask } = useTaskStore();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setStatus(task.status);
      setProgress(task.progress);
      setDeadline(
        task.deadline
          ? new Date(task.deadline).toISOString().slice(0, 16)
          : '',
      );
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim()) return;

    setIsSubmitting(true);
    try {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        progress,
        deadline: deadline || null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!task) return null;

  const agents = task.assignedAgents ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Edit Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Read-only assignment info */}
        {(task.createdByAgentName || task.teamName || agents.length > 0) && (
          <div className="rounded-lg border border-border bg-bg p-3 space-y-2.5">
            {task.createdByAgentName && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Bot size={12} className="text-primary-400 shrink-0" />
                <span>Created by <span className="font-medium text-text-primary">{task.createdByAgentName}</span></span>
              </div>
            )}

            {task.teamName && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Users size={12} className="text-primary-400 shrink-0" />
                <span>Team: <span className="font-medium text-text-primary">{task.teamName}</span></span>
              </div>
            )}

            {agents.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Assigned Agents</p>
                <div className="flex flex-wrap gap-1.5">
                  {agents.map((agent) => (
                    <span
                      key={agent.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-surface-light px-2 py-1 text-xs text-text-primary"
                    >
                      <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-primary-600/20">
                        <Bot size={8} className="text-primary-400" />
                        <span
                          className={clsx(
                            'absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-surface-light',
                            AGENT_STATUS_COLORS[agent.status] || 'bg-gray-500',
                          )}
                        />
                      </span>
                      {agent.name}
                      <span className="text-text-secondary">· {agent.role}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500 resize-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">Priority</label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors ${
                  p === priority
                    ? 'border-primary-500 bg-primary-600/15 text-primary-400'
                    : 'border-border text-text-secondary hover:bg-surface-light'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">Status</label>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors ${
                  s === status
                    ? 'border-primary-500 bg-primary-600/15 text-primary-400'
                    : 'border-border text-text-secondary hover:bg-surface-light'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Progress ({progress}%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Deadline</label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary outline-none focus:border-primary-500"
            />
            {deadline && (
              <button
                type="button"
                onClick={() => setDeadline('')}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-light"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
