import { useEffect } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAgentStore } from '@/stores/agent.store';
import { useTaskStore } from '@/stores/task.store';

export function ActivityPage() {
  const { agents, fetchAgents } = useAgentStore();
  const { tasks, fetchTasks } = useTaskStore();

  useEffect(() => {
    fetchAgents();
    fetchTasks();
  }, [fetchAgents, fetchTasks]);

  const activeAgents = agents.filter((a) => a.status !== 'offline');
  const recentTasks = tasks.slice(0, 10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Activity</h1>
        <p className="mt-1 text-sm text-text-secondary">Real-time overview of your workspace.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent Status */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">
            Agent Status ({activeAgents.length} online)
          </h2>
          <div className="space-y-3">
            {activeAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={agent.status} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                    <p className="text-xs text-text-secondary">{agent.role}</p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">
                  {new Date(agent.lastActive).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
            {activeAgents.length === 0 && (
              <p className="py-4 text-center text-sm text-text-secondary">No agents online</p>
            )}
          </div>
        </div>

        {/* Recent Task Updates */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Recent Tasks</h2>
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                  <p className="text-xs text-text-secondary">Priority: {task.priority}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
            {recentTasks.length === 0 && (
              <p className="py-4 text-center text-sm text-text-secondary">No tasks</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
