import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useAgentStore } from '@/stores/agent.store';

interface CreateAgentModalProps {
  open: boolean;
  onClose: () => void;
  teamId?: string;
}

const PRESET_ROLES = [
  { label: 'Researcher', role: 'Research Specialist', specialty: ['web search', 'data analysis', 'fact checking'] },
  { label: 'Developer', role: 'Software Developer', specialty: ['coding', 'debugging', 'testing'] },
  { label: 'Writer', role: 'Content Writer', specialty: ['writing', 'editing', 'content creation'] },
  { label: 'Analyst', role: 'Data Analyst', specialty: ['data analysis', 'visualization', 'reporting'] },
  { label: 'Custom', role: '', specialty: [] },
];

export function CreateAgentModal({ open, onClose, teamId }: CreateAgentModalProps) {
  const [name, setName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customRole, setCustomRole] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [personality, setPersonality] = useState('');
  const [modelProvider, setModelProvider] = useState<'anthropic' | 'ollama'>('anthropic');
  const [modelName, setModelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createAgent } = useAgentStore();

  const preset = PRESET_ROLES[selectedPreset];
  const isCustom = preset.label === 'Custom';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createAgent({
        name: name.trim(),
        role: isCustom ? customRole.trim() : preset.role,
        specialty: isCustom ? customSpecialty.split(',').map((s) => s.trim()).filter(Boolean) : preset.specialty,
        teamId,
        personality: personality.trim() || undefined,
        modelProvider,
        modelName: modelProvider === 'ollama' && modelName.trim() ? modelName.trim() : undefined,
      });
      setName('');
      setCustomRole('');
      setCustomSpecialty('');
      setPersonality('');
      setModelProvider('anthropic');
      setModelName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Agent">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Agent Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., DataCollector"
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">Role Preset</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ROLES.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSelectedPreset(i)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  i === selectedPreset
                    ? 'border-primary-500 bg-primary-600/15 text-primary-400'
                    : 'border-border text-text-secondary hover:bg-surface-light'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {isCustom && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Role</label>
              <input
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g., Design Specialist"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Specialties (comma-separated)
              </label>
              <input
                value={customSpecialty}
                onChange={(e) => setCustomSpecialty(e.target.value)}
                placeholder="e.g., UI design, prototyping, user research"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Personality & Tone (optional)
          </label>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="e.g., You are concise, direct, and technical. You prefer bullet points over prose."
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500 resize-none"
          />
          <p className="mt-1 text-xs text-text-secondary">
            Defines how this agent communicates. Leave blank for default behavior.
          </p>
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
            <p className="mt-1 text-xs text-text-secondary">
              The Ollama model to use. Make sure it's pulled locally.
            </p>
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
            {isSubmitting ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
