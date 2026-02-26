import { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useAgentStore } from '@/stores/agent.store';
import { useTeamStore } from '@/stores/team.store';
import type { Agent } from '@/types';

interface EditAgentModalProps {
  open: boolean;
  onClose: () => void;
  agent: Agent | null;
}

export function EditAgentModal({ open, onClose, agent }: EditAgentModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [personality, setPersonality] = useState('');
  const [modelProvider, setModelProvider] = useState<'anthropic' | 'ollama'>('anthropic');
  const [modelName, setModelName] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateAgent } = useAgentStore();
  const { teams } = useTeamStore();

  useEffect(() => {
    if (agent && open) {
      setName(agent.name);
      setRole(agent.role);
      setSpecialty(agent.specialty.join(', '));
      setPersonality(agent.personality ?? '');
      setModelProvider((agent.modelProvider as 'anthropic' | 'ollama') ?? 'anthropic');
      setModelName(agent.modelName ?? '');
      setTeamId(agent.teamId ?? '');
    }
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateAgent(agent.id, {
        name: name.trim(),
        role: role.trim(),
        specialty: specialty
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        personality: personality.trim() || null,
        modelProvider,
        modelName: modelProvider === 'ollama' && modelName.trim() ? modelName.trim() : undefined,
        teamId: teamId || null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!agent) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${agent.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Agent Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Role</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Research Specialist"
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Specialties (comma-separated)
          </label>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="e.g., web search, data analysis"
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary outline-none focus:border-primary-500"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Personality & Tone
          </label>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="e.g., You are concise, direct, and technical."
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500 resize-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">Model Provider</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModelProvider('anthropic')}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                modelProvider === 'anthropic'
                  ? 'border-primary-500 bg-primary-600/15 text-primary-400'
                  : 'border-border text-text-secondary hover:bg-surface-light'
              }`}
            >
              Anthropic Claude
            </button>
            <button
              type="button"
              onClick={() => setModelProvider('ollama')}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                modelProvider === 'ollama'
                  ? 'border-primary-500 bg-primary-600/15 text-primary-400'
                  : 'border-border text-text-secondary hover:bg-surface-light'
              }`}
            >
              Ollama (Local)
            </button>
          </div>
        </div>

        {modelProvider === 'ollama' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Model Name</label>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., llama3.2, mistral, qwen2.5"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            />
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
            disabled={!name.trim() || isSubmitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
