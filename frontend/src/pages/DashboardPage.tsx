import { useEffect, useState } from 'react';
import { Plus, Building2, Layers, Users, Bot, ChevronRight, ChevronDown } from 'lucide-react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { TeamCard } from '@/components/teams/TeamCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { SystemMonitor } from '@/components/dashboard/SystemMonitor';
import { CreateTeamModal } from '@/components/modals/CreateTeamModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { useAgentStore } from '@/stores/agent.store';
import { useTeamStore } from '@/stores/team.store';
import { useTaskStore } from '@/stores/task.store';
import { useOrganizationStore } from '@/stores/organization.store';

export function DashboardPage() {
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const { agents, fetchAgents, fetchMainAgent } = useAgentStore();
  const { teams, fetchTeams } = useTeamStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { organizations, fetchOrganizations } = useOrganizationStore();

  useEffect(() => {
    fetchAgents();
    fetchMainAgent();
    fetchTeams();
    fetchTasks();
    fetchOrganizations();
  }, [fetchAgents, fetchMainAgent, fetchTeams, fetchTasks, fetchOrganizations]);

  const toggleOrg = (id: string) => {
    const next = new Set(expandedOrgs);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedOrgs(next);
  };

  const toggleDept = (id: string) => {
    const next = new Set(expandedDepts);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedDepts(next);
  };

  const activeAgents = agents.filter((a) => a.status === 'active' || a.status === 'busy');
  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Chat with Main Agent */}
      <div className="h-[400px]">
        <ChatInterface />
      </div>

      {/* Two-column: Teams + System Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Teams */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Teams ({teams.length})
            </h2>
            <button
              onClick={() => setShowCreateTeam(true)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-600/10"
            >
              <Plus size={14} />
              Create Team
            </button>
          </div>
          <div className="space-y-3">
            {teams.length === 0 && (
              <p className="py-8 text-center text-sm text-text-secondary">
                No teams yet. Create one to get started.
              </p>
            )}
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </div>

        {/* System Activity */}
        <SystemMonitor
          activities={activeAgents.map((a) => ({
            id: a.id,
            agent: a.name,
            action: a.status === 'busy' ? 'is working...' : 'is active',
            type: a.status === 'busy' ? ('info' as const) : ('success' as const),
            timestamp: new Date(a.lastActive).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }))}
        />
      </div>

      {/* Organization Hierarchy */}
      {organizations.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Organization Hierarchy ({organizations.length})
          </h2>
          <div className="space-y-2">
            {organizations.map((org) => (
              <div key={org.id} className="rounded-xl border border-border bg-surface">
                <button
                  onClick={() => toggleOrg(org.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-light"
                >
                  {expandedOrgs.has(org.id) ? (
                    <ChevronDown size={14} className="text-text-secondary" />
                  ) : (
                    <ChevronRight size={14} className="text-text-secondary" />
                  )}
                  <Building2 size={16} className="text-primary-400" />
                  <span className="flex-1 text-sm font-medium text-text-primary">{org.name}</span>
                  <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
                    {org.departments.length} dept{org.departments.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {expandedOrgs.has(org.id) && org.departments.length > 0 && (
                  <div className="border-t border-border px-4 py-2 space-y-1">
                    {org.departments.map((dept) => (
                      <div key={dept.id}>
                        <button
                          onClick={() => toggleDept(dept.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface-light/50"
                        >
                          {expandedDepts.has(dept.id) ? (
                            <ChevronDown size={12} className="text-text-secondary" />
                          ) : (
                            <ChevronRight size={12} className="text-text-secondary" />
                          )}
                          <Layers size={14} className="text-blue-400" />
                          <span className="flex-1 text-sm text-text-primary">{dept.name}</span>
                          <span className="text-xs text-text-secondary">
                            {dept.teams.length} team{dept.teams.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {expandedDepts.has(dept.id) && dept.teams.length > 0 && (
                          <div className="ml-7 space-y-1 pb-1">
                            {dept.teams.map((team) => (
                              <div key={team.id} className="flex items-center gap-2 rounded-lg bg-background px-3 py-1.5">
                                <Users size={12} className="text-green-400" />
                                <span className="text-sm text-text-primary">{team.name}</span>
                                {team.agents && team.agents.length > 0 && (
                                  <div className="ml-auto flex items-center gap-1">
                                    <Bot size={11} className="text-text-secondary" />
                                    <span className="text-xs text-text-secondary">{team.agents.length}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Active Tasks ({tasks.length})
          </h2>
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-600/10"
          >
            <Plus size={14} />
            Create Task
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentTasks.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-text-secondary">
              No tasks yet.
            </p>
          )}
          {recentTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>

      <CreateTeamModal open={showCreateTeam} onClose={() => setShowCreateTeam(false)} />
      <CreateTaskModal open={showCreateTask} onClose={() => setShowCreateTask(false)} />
    </div>
  );
}
