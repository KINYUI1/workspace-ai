import { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useTaskStore } from '@/stores/task.store';
import { useAgentStore } from '@/stores/agent.store';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  teamId?: string;
}

export function CreateTaskModal({ open, onClose, teamId }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [deadline, setDeadline] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createTask } = useTaskStore();
  const { agents, fetchAgents } = useAgentStore();

  useEffect(() => {
    if (open) fetchAgents();
  }, [open, fetchAgents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        teamId,
        ...(deadline ? { deadline } : {}),
        ...(selectedAgents.length > 0 ? { assignTo: selectedAgents } : {}),
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDeadline('');
      setSelectedAgents([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };

  const priorities = ['low', 'medium', 'high', 'critical'] as const;

  return (
    <Modal open={open} onClose={onClose} title="Create Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Analyze Q4 sales data"
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what needs to be done..."
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
          <label className="mb-1 block text-sm font-medium text-text-primary">Deadline</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary outline-none focus:border-primary-500"
          />
        </div>

        {agents.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">
              Assign Agents {selectedAgents.length > 0 && `(${selectedAgents.length})`}
            </label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-light"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgents.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="accent-primary-500"
                  />
                  <span className="text-text-primary">{agent.name}</span>
                  <span className="text-xs text-text-secondary">({agent.role})</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
