import { useEffect, useState } from 'react';
import { Plus, Puzzle, Trash2, Bot, Globe, Webhook } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '@/components/shared/Modal';
import { api } from '@/services/api';

interface Skill {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  toolDefinition: Record<string, unknown>;
  handlerType: string;
  handlerConfig: Record<string, unknown>;
  isPublic: boolean;
  createdAt: string;
}

interface AgentBasic {
  id: string;
  name: string;
  role: string;
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [agents, setAgents] = useState<AgentBasic[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [agentSkills, setAgentSkills] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formToolName, setFormToolName] = useState('');
  const [formToolDesc, setFormToolDesc] = useState('');
  const [formParams, setFormParams] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [skillsRes, agentsRes] = await Promise.all([
        api.getSkills(),
        api.getAgents(1, 100),
      ]);
      setSkills((skillsRes.data as Skill[]) ?? []);
      const agentList = (agentsRes.data as AgentBasic[]) ?? [];
      setAgents(agentList);

      // Load skills for each agent
      const skillMap: Record<string, string[]> = {};
      await Promise.all(
        agentList.map(async (agent) => {
          const res = await api.getAgentSkills(agent.id);
          skillMap[agent.id] = ((res.data as Skill[]) ?? []).map((s) => s.id);
        }),
      );
      setAgentSkills(skillMap);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formToolName.trim()) return;

    setIsSubmitting(true);
    try {
      // Parse parameters JSON
      let properties: Record<string, unknown> = {};
      let required: string[] = [];
      if (formParams.trim()) {
        try {
          const parsed = JSON.parse(formParams);
          properties = parsed.properties ?? parsed;
          required = parsed.required ?? [];
        } catch {
          alert('Invalid JSON for parameters');
          return;
        }
      }

      await api.createSkill({
        name: formName.trim(),
        description: formDesc.trim(),
        handlerType: 'webhook',
        handlerConfig: { webhookUrl: formWebhookUrl.trim() },
        toolDefinition: {
          name: formToolName.trim(),
          description: formToolDesc.trim() || formDesc.trim(),
          input_schema: {
            type: 'object',
            properties,
            required,
          },
        },
      });
      setFormName('');
      setFormDesc('');
      setFormWebhookUrl('');
      setFormToolName('');
      setFormToolDesc('');
      setFormParams('');
      setShowCreate(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (skillId: string) => {
    await api.deleteSkill(skillId);
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
    if (selectedSkill?.id === skillId) setSelectedSkill(null);
  };

  const toggleSkillForAgent = async (agentId: string, skillId: string) => {
    const current = agentSkills[agentId] ?? [];
    if (current.includes(skillId)) {
      await api.disableSkillForAgent(agentId, skillId);
      setAgentSkills((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] ?? []).filter((id) => id !== skillId),
      }));
    } else {
      await api.enableSkillForAgent(agentId, skillId);
      setAgentSkills((prev) => ({
        ...prev,
        [agentId]: [...(prev[agentId] ?? []), skillId],
      }));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Skills</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {skills.length} skill{skills.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          Create Skill
        </button>
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-text-secondary">Loading skills...</p>
      )}

      {!isLoading && (
        <div className="flex gap-6">
          {/* Skills List */}
          <div className="w-80 flex-shrink-0 space-y-2">
            {skills.length === 0 && (
              <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <Puzzle size={32} className="mx-auto mb-3 text-text-secondary" />
                <p className="text-sm text-text-secondary">
                  No skills yet. Create one to extend your agents' capabilities.
                </p>
              </div>
            )}
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => setSelectedSkill(skill)}
                className={clsx(
                  'w-full rounded-xl border p-3 text-left transition-colors',
                  selectedSkill?.id === skill.id
                    ? 'border-primary-500 bg-primary-600/10'
                    : 'border-border bg-surface hover:bg-surface-light',
                )}
              >
                <div className="flex items-center gap-2">
                  <Webhook size={14} className="text-primary-400" />
                  <span className="text-sm font-medium text-text-primary">{skill.name}</span>
                  {skill.isPublic && (
                    <Globe size={12} className="text-text-secondary" />
                  )}
                </div>
                <p className="mt-1 text-xs text-text-secondary line-clamp-2">{skill.description}</p>
              </button>
            ))}
          </div>

          {/* Skill Detail */}
          <div className="flex-1">
            {!selectedSkill && (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <p className="text-sm text-text-secondary">Select a skill to view details</p>
              </div>
            )}

            {selectedSkill && (
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selectedSkill.name}</h2>
                    <p className="mt-1 text-sm text-text-secondary">{selectedSkill.description}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(selectedSkill.id)}
                    className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-red-400"
                    title="Delete skill"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <span className="text-xs font-medium uppercase text-text-secondary">Handler</span>
                    <p className="mt-0.5 text-sm text-text-primary capitalize">{selectedSkill.handlerType}</p>
                  </div>
                  {selectedSkill.handlerType === 'webhook' && (
                    <div>
                      <span className="text-xs font-medium uppercase text-text-secondary">Webhook URL</span>
                      <p className="mt-0.5 text-sm text-text-primary font-mono text-xs break-all">
                        {(selectedSkill.handlerConfig.webhookUrl as string) || 'Not set'}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium uppercase text-text-secondary">Tool Name</span>
                    <p className="mt-0.5 text-sm text-text-primary font-mono">
                      {(selectedSkill.toolDefinition.name as string) || '-'}
                    </p>
                  </div>
                </div>

                {/* Agent Enable/Disable */}
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-medium text-text-primary">Enable for Agents</h3>
                  <div className="space-y-2">
                    {agents.filter((a) => !(a as any).isMainAgent).map((agent) => {
                      const enabled = (agentSkills[agent.id] ?? []).includes(selectedSkill.id);
                      return (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between rounded-lg border border-border p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <Bot size={14} className="text-text-secondary" />
                            <span className="text-sm text-text-primary">{agent.name}</span>
                            <span className="text-xs text-text-secondary">{agent.role}</span>
                          </div>
                          <button
                            onClick={() => toggleSkillForAgent(agent.id, selectedSkill.id)}
                            className={clsx(
                              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                              enabled
                                ? 'bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400'
                                : 'bg-surface-light text-text-secondary hover:bg-primary-600/15 hover:text-primary-400',
                            )}
                          >
                            {enabled ? 'Enabled' : 'Enable'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Skill Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Custom Skill">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Skill Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Jira Integration"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Description</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="What this skill does..."
              rows={2}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500 resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Webhook URL</label>
            <input
              value={formWebhookUrl}
              onChange={(e) => setFormWebhookUrl(e.target.value)}
              placeholder="https://your-webhook.example.com/handler"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Tool Name (for agents)</label>
            <input
              value={formToolName}
              onChange={(e) => setFormToolName(e.target.value)}
              placeholder="e.g., create_jira_ticket"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Tool Description</label>
            <input
              value={formToolDesc}
              onChange={(e) => setFormToolDesc(e.target.value)}
              placeholder="Create a Jira ticket with title, description, and assignee"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">
              Parameters Schema (JSON, optional)
            </label>
            <textarea
              value={formParams}
              onChange={(e) => setFormParams(e.target.value)}
              placeholder={'{\n  "properties": {\n    "title": { "type": "string" }\n  },\n  "required": ["title"]\n}'}
              rows={4}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500 resize-none font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formName.trim() || !formToolName.trim() || isSubmitting}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40"
            >
              {isSubmitting ? 'Creating...' : 'Create Skill'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
