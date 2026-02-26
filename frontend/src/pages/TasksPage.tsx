import { useEffect, useState, useMemo } from 'react';
import { Plus, Clock, Trash2, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { EditTaskModal } from '@/components/modals/EditTaskModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useTaskStore } from '@/stores/task.store';
import { api } from '@/services/api';
import type { Task } from '@/types';

const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'blocked', 'completed', 'failed'] as const;
const PRIORITY_FILTERS = ['all', 'critical', 'high', 'medium', 'low'] as const;

interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  scheduleType: string;
  runAt: string | null;
  cronExpression: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export function TasksPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'tasks' | 'scheduled'>('tasks');
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  // Edit modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Delete confirmation
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { tasks, isLoading, fetchTasks, deleteTask } = useTaskStore();

  // Build filters for the API call (status + priority)
  useEffect(() => {
    const filters: Record<string, string> = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (priorityFilter !== 'all') filters.priority = priorityFilter;
    fetchTasks(Object.keys(filters).length > 0 ? filters : undefined);
  }, [fetchTasks, statusFilter, priorityFilter]);

  useEffect(() => {
    if (tab === 'scheduled') {
      setScheduledLoading(true);
      api.getScheduledTasks().then((res) => {
        setScheduledTasks((res.data as ScheduledTask[]) ?? []);
      }).finally(() => setScheduledLoading(false));
    }
  }, [tab]);

  // Client-side search filtering
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)),
    );
  }, [tasks, searchQuery]);

  const handleDelete = async () => {
    if (!deletingTaskId) return;
    setIsDeleting(true);
    try {
      await deleteTask(deletingTaskId);
    } finally {
      setIsDeleting(false);
      setDeletingTaskId(null);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    await api.cancelScheduledTask(id);
    setScheduledTasks((prev) => prev.map((t) => t.id === id ? { ...t, enabled: false } : t));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Tasks</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {tab === 'tasks'
              ? `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`
              : `${scheduledTasks.length} scheduled task${scheduledTasks.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          Create Task
        </button>
      </div>

      {/* Tab Toggle */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-surface p-1">
        <button
          onClick={() => setTab('tasks')}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'tasks'
              ? 'bg-primary-600/15 text-primary-400'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          Tasks
        </button>
        <button
          onClick={() => setTab('scheduled')}
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'scheduled'
              ? 'bg-primary-600/15 text-primary-400'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <Clock size={14} />
          Scheduled
        </button>
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-text-secondary">Status:</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm capitalize transition-colors',
                  f === statusFilter
                    ? 'bg-primary-600/15 text-primary-400'
                    : 'text-text-secondary hover:bg-surface-light',
                )}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Priority Filters */}
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-text-secondary">Priority:</span>
            {PRIORITY_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setPriorityFilter(f)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm capitalize transition-colors',
                  f === priorityFilter
                    ? 'bg-primary-600/15 text-primary-400'
                    : 'text-text-secondary hover:bg-surface-light',
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {isLoading && (
            <p className="py-12 text-center text-sm text-text-secondary">Loading tasks...</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!isLoading && filteredTasks.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border py-12 text-center">
                <p className="text-sm text-text-secondary">
                  {searchQuery ? 'No tasks match your search.' : 'No tasks found.'}
                </p>
              </div>
            )}
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => setEditingTask(task)}
                onDelete={() => setDeletingTaskId(task.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Scheduled Tab */}
      {tab === 'scheduled' && (
        <>
          {scheduledLoading && (
            <p className="py-12 text-center text-sm text-text-secondary">Loading scheduled tasks...</p>
          )}

          {!scheduledLoading && scheduledTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <Clock size={32} className="mx-auto mb-3 text-text-secondary" />
              <p className="text-sm text-text-secondary">
                No scheduled tasks yet. Agents can schedule recurring tasks using the schedule_task tool.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {scheduledTasks.map((st) => (
              <div
                key={st.id}
                className={clsx(
                  'rounded-xl border border-border bg-surface p-4',
                  !st.enabled && 'opacity-50',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-text-primary">{st.title}</h3>
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          st.enabled
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400',
                        )}
                      >
                        {st.enabled ? 'Active' : 'Cancelled'}
                      </span>
                      <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
                        {st.scheduleType === 'cron' ? 'Recurring' : 'One-time'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{st.description}</p>
                    <div className="mt-2 flex gap-4 text-xs text-text-secondary">
                      {st.scheduleType === 'cron' && st.cronExpression && (
                        <span>Cron: <code className="text-text-primary">{st.cronExpression}</code></span>
                      )}
                      {st.scheduleType === 'once' && st.runAt && (
                        <span>Run at: {new Date(st.runAt).toLocaleString()}</span>
                      )}
                      {st.lastRunAt && (
                        <span>Last run: {new Date(st.lastRunAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  {st.enabled && (
                    <button
                      onClick={() => handleCancelScheduled(st.id)}
                      className="ml-3 rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-red-400"
                      title="Cancel scheduled task"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} />

      <EditTaskModal
        open={editingTask !== null}
        onClose={() => setEditingTask(null)}
        task={editingTask}
      />

      <ConfirmDialog
        open={deletingTaskId !== null}
        onClose={() => setDeletingTaskId(null)}
        onConfirm={handleDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
