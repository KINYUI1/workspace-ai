import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useTeamStore } from '@/stores/team.store';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamModal({ open, onClose }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createTeam } = useTeamStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createTeam({ name: name.trim(), goal: goal.trim(), description: description.trim() });
      setName('');
      setGoal('');
      setDescription('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Team">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Team Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Data Analysis"
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Goal</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., Analyze business data and generate insights"
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500 resize-none"
          />
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
            disabled={!name.trim() || isSubmitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {isSubmitting ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
