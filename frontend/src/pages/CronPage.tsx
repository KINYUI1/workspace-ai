import { useEffect, useState } from 'react';
import { Clock, Plus, Trash2, Power, PowerOff, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/services/api';
import { CronBuilder } from '@/components/cron/CronBuilder';

interface CronJob {
  id: string;
  name: string;
  expression: string;
  description: string;
  taskDescription: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newExpression, setNewExpression] = useState('0 * * * *');
  const [newDescription, setNewDescription] = useState('');
  const [newTask, setNewTask] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.getCronJobs();
      setJobs((res as any).data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createCronJob({
        name: newName,
        expression: newExpression,
        description: newDescription,
        taskDescription: newTask,
      });
      setJobs((prev) => [...prev, (res as any).data]);
      setShowCreate(false);
      setNewName('');
      setNewExpression('0 * * * *');
      setNewDescription('');
      setNewTask('');
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await api.updateCronJob(id, { enabled });
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled } : j)));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCronJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-text-secondary" />
          <h1 className="text-xl font-bold text-text-primary">Cron Jobs</h1>
          <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
            {jobs.length}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
        >
          <Plus size={14} />
          New Cron Job
        </button>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-5 h-24" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-16">
          <Clock size={48} className="mb-4 text-text-secondary opacity-20" />
          <p className="text-sm text-text-secondary">No cron jobs configured</p>
          <p className="mt-1 text-xs text-text-secondary opacity-60">
            Create scheduled jobs to automate agent tasks
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={clsx(
                'rounded-xl border bg-surface p-5 transition-colors',
                job.enabled ? 'border-border' : 'border-border/50 opacity-60',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-text-primary">{job.name}</h3>
                    <code className="rounded bg-surface-light px-2 py-0.5 text-[10px] font-mono text-primary-400">
                      {job.expression}
                    </code>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        job.enabled ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
                      )}
                    >
                      {job.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {job.description && (
                    <p className="mt-1 text-xs text-text-secondary">{job.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
                    {job.lastRunAt && (
                      <span>Last: {new Date(job.lastRunAt).toLocaleString()}</span>
                    )}
                    {job.nextRunAt && (
                      <span>Next: {new Date(job.nextRunAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(job.id, !job.enabled)}
                    className={clsx(
                      'rounded-lg p-2 transition-colors',
                      job.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-text-secondary hover:bg-surface-light',
                    )}
                    title={job.enabled ? 'Pause' : 'Resume'}
                  >
                    {job.enabled ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="rounded-lg p-2 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">New Cron Job</h3>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Daily report generation"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this job does..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Schedule</label>
                <CronBuilder value={newExpression} onChange={setNewExpression} />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Task for Agent</label>
                <textarea
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Describe what the agent should do when this job runs..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
