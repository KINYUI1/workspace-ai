import { useEffect, useState } from 'react';
import {
  Building2,
  Layers,
  Users,
  Bot,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { useOrganizationStore } from '@/stores/organization.store';
import { useTeamStore } from '@/stores/team.store';
import { useAgentStore } from '@/stores/agent.store';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function OrganizationPage() {
  const {
    organizations,
    isLoading,
    fetchOrganizations,
    createOrganization,
    deleteOrganization,
    createDepartment,
    deleteDepartment,
    moveDepartment,
    assignTeamToDepartment,
    removeTeamFromDepartment,
  } = useOrganizationStore();
  const { teams, fetchTeams } = useTeamStore();
  const { fetchAgents } = useAgentStore();

  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateDept, setShowCreateDept] = useState<string | null>(null);
  const [showAssignTeam, setShowAssignTeam] = useState<{ orgId: string; deptId: string } | null>(null);

  // Delete confirmations
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [deleteDeptCtx, setDeleteDeptCtx] = useState<{ orgId: string; deptId: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Move department
  const [moveDeptCtx, setMoveDeptCtx] = useState<{ orgId: string; deptId: string; name: string } | null>(null);
  const [moveTargetOrgId, setMoveTargetOrgId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Move team
  const [moveTeamCtx, setMoveTeamCtx] = useState<{ orgId: string; deptId: string; teamId: string; teamName: string } | null>(null);
  const [moveTeamTargetDeptId, setMoveTeamTargetDeptId] = useState('');
  const [moveTeamTargetOrgId, setMoveTeamTargetOrgId] = useState('');
  const [isMovingTeam, setIsMovingTeam] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  useEffect(() => {
    fetchOrganizations();
    fetchTeams();
    fetchAgents();
  }, [fetchOrganizations, fetchTeams, fetchAgents]);

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

  const handleCreateOrg = async () => {
    if (!formName.trim()) return;
    await createOrganization({ name: formName.trim(), description: formDescription.trim() || undefined });
    setFormName('');
    setFormDescription('');
    setShowCreateOrg(false);
  };

  const handleCreateDept = async () => {
    if (!formName.trim() || !showCreateDept) return;
    await createDepartment(showCreateDept, { name: formName.trim(), description: formDescription.trim() || undefined });
    setFormName('');
    setFormDescription('');
    setShowCreateDept(null);
  };

  const handleAssignTeam = async () => {
    if (!selectedTeamId || !showAssignTeam) return;
    await assignTeamToDepartment(showAssignTeam.orgId, showAssignTeam.deptId, selectedTeamId);
    setSelectedTeamId('');
    setShowAssignTeam(null);
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrgId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteOrganization(deleteOrgId);
      setDeleteOrgId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete organization';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!deleteDeptCtx) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDepartment(deleteDeptCtx.orgId, deleteDeptCtx.deptId);
      setDeleteDeptCtx(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveDept = async () => {
    if (!moveDeptCtx || !moveTargetOrgId) return;
    setIsMoving(true);
    try {
      await moveDepartment(moveDeptCtx.orgId, moveDeptCtx.deptId, moveTargetOrgId);
      setMoveDeptCtx(null);
      setMoveTargetOrgId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to move department';
      setDeleteError(msg);
    } finally {
      setIsMoving(false);
    }
  };

  const handleMoveTeam = async () => {
    if (!moveTeamCtx || !moveTeamTargetDeptId || !moveTeamTargetOrgId) return;
    setIsMovingTeam(true);
    try {
      // Remove from current department, then add to target
      await removeTeamFromDepartment(moveTeamCtx.orgId, moveTeamCtx.deptId, moveTeamCtx.teamId);
      await assignTeamToDepartment(moveTeamTargetOrgId, moveTeamTargetDeptId, moveTeamCtx.teamId);
      setMoveTeamCtx(null);
      setMoveTeamTargetDeptId('');
      setMoveTeamTargetOrgId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to move team';
      setDeleteError(msg);
    } finally {
      setIsMovingTeam(false);
    }
  };

  const handleRemoveTeam = async (orgId: string, deptId: string, teamId: string) => {
    try {
      await removeTeamFromDepartment(orgId, deptId, teamId);
    } catch {
      // Error handled by store
    }
  };

  // Teams not yet in any department
  const unassignedTeams = teams.filter((t) => {
    for (const org of organizations) {
      for (const dept of org.departments) {
        if (dept.teams.some((dt) => dt.id === t.id)) return false;
      }
    }
    return true;
  });

  // All departments across all orgs (for move team target)
  const allDepartments = organizations.flatMap((org) =>
    org.departments.map((d) => ({ ...d, orgId: org.id, orgName: org.name })),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Organization</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your organization hierarchy: Organizations, Departments, Teams, and Agents.
          </p>
        </div>
        <button
          onClick={() => setShowCreateOrg(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          New Organization
        </button>
      </div>

      {/* Error toast */}
      {deleteError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      {isLoading && (
        <p className="py-12 text-center text-sm text-text-secondary">Loading...</p>
      )}

      {!isLoading && organizations.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 size={40} className="mx-auto mb-3 text-text-secondary/30" />
          <p className="text-sm text-text-secondary">
            No organizations yet. Create one to build your hierarchy.
          </p>
        </div>
      )}

      {/* Org Tree */}
      <div className="space-y-3">
        {organizations.map((org) => (
          <div key={org.id} className="rounded-xl border border-border bg-surface">
            {/* Organization header */}
            <div className="flex items-center">
              <button
                onClick={() => toggleOrg(org.id)}
                className="flex flex-1 items-center gap-3 px-5 py-4 text-left hover:bg-surface-light"
              >
                {expandedOrgs.has(org.id) ? (
                  <ChevronDown size={16} className="text-text-secondary" />
                ) : (
                  <ChevronRight size={16} className="text-text-secondary" />
                )}
                <Building2 size={18} className="text-primary-400" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">{org.name}</h3>
                  {org.description && (
                    <p className="text-xs text-text-secondary">{org.description}</p>
                  )}
                </div>
                <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
                  {org.departments.length} dept{org.departments.length !== 1 ? 's' : ''}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOrgId(org.id);
                  setDeleteError(null);
                }}
                disabled={org.departments.length > 0}
                title={
                  org.departments.length > 0
                    ? 'Remove all departments first'
                    : 'Delete organization'
                }
                className="mr-3 rounded p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Expanded: Departments */}
            {expandedOrgs.has(org.id) && (
              <div className="border-t border-border px-5 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase text-text-secondary">Departments</p>
                  <button
                    onClick={() => {
                      setFormName('');
                      setFormDescription('');
                      setShowCreateDept(org.id);
                    }}
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    + Add Department
                  </button>
                </div>

                {org.departments.length === 0 && (
                  <p className="py-2 text-xs text-text-secondary">No departments</p>
                )}

                <div className="space-y-2">
                  {org.departments.map((dept) => (
                    <div key={dept.id} className="rounded-lg border border-border/50 bg-background">
                      {/* Department header */}
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleDept(dept.id)}
                          className="flex flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-surface-light/50"
                        >
                          {expandedDepts.has(dept.id) ? (
                            <ChevronDown size={14} className="text-text-secondary" />
                          ) : (
                            <ChevronRight size={14} className="text-text-secondary" />
                          )}
                          <Layers size={16} className="text-blue-400" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-text-primary">{dept.name}</span>
                            {dept.description && (
                              <p className="text-xs text-text-secondary">{dept.description}</p>
                            )}
                          </div>
                          <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
                            {dept.teams.length} team{dept.teams.length !== 1 ? 's' : ''}
                          </span>
                        </button>
                        <div className="mr-2 flex items-center gap-1">
                          {organizations.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveDeptCtx({ orgId: org.id, deptId: dept.id, name: dept.name });
                                setMoveTargetOrgId('');
                                setDeleteError(null);
                              }}
                              title="Move to another organization"
                              className="rounded p-1.5 text-text-secondary hover:bg-primary-600/10 hover:text-primary-400"
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDeptCtx({ orgId: org.id, deptId: dept.id, name: dept.name });
                              setDeleteError(null);
                            }}
                            disabled={dept.teams.length > 0}
                            title={
                              dept.teams.length > 0
                                ? 'Remove all teams first'
                                : 'Delete department'
                            }
                            className="rounded p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded: Teams under department */}
                      {expandedDepts.has(dept.id) && (
                        <div className="border-t border-border/50 px-4 py-2">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs text-text-secondary">Teams</p>
                            {unassignedTeams.length > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedTeamId('');
                                  setShowAssignTeam({ orgId: org.id, deptId: dept.id });
                                }}
                                className="text-xs text-primary-400 hover:text-primary-300"
                              >
                                + Assign Team
                              </button>
                            )}
                          </div>

                          {dept.teams.length === 0 && (
                            <p className="py-1 text-xs text-text-secondary">No teams assigned</p>
                          )}

                          {dept.teams.map((team) => (
                            <div
                              key={team.id}
                              className="mb-1 rounded-lg bg-surface px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <Users size={14} className="text-green-400" />
                                <span className="flex-1 text-sm font-medium text-text-primary">
                                  {team.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  {allDepartments.length > 1 && (
                                    <button
                                      onClick={() => {
                                        setMoveTeamCtx({
                                          orgId: org.id,
                                          deptId: dept.id,
                                          teamId: team.id,
                                          teamName: team.name,
                                        });
                                        setMoveTeamTargetDeptId('');
                                        setMoveTeamTargetOrgId('');
                                        setDeleteError(null);
                                      }}
                                      title="Move to another department"
                                      className="rounded p-1 text-text-secondary hover:bg-primary-600/10 hover:text-primary-400"
                                    >
                                      <ArrowRightLeft size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRemoveTeam(org.id, dept.id, team.id)}
                                    title="Remove from department"
                                    className="rounded p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                              {team.agents && team.agents.length > 0 && (
                                <div className="ml-5 mt-1 space-y-0.5">
                                  {team.agents.map((agent) => (
                                    <div
                                      key={agent.id}
                                      className="flex items-center gap-2 text-xs text-text-secondary"
                                    >
                                      <Bot size={12} />
                                      <span>{agent.name}</span>
                                      <span className="text-text-secondary/60">({agent.role})</span>
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          agent.status === 'busy'
                                            ? 'bg-yellow-400'
                                            : agent.status === 'error'
                                              ? 'bg-red-400'
                                              : 'bg-green-400'
                                        }`}
                                      />
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
          </div>
        ))}
      </div>

      {/* Create Organization Modal */}
      <Modal open={showCreateOrg} onClose={() => setShowCreateOrg(false)} title="Create Organization">
        <div className="space-y-3">
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Organization name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
          />
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateOrg(false)}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateOrg}
              disabled={!formName.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Department Modal */}
      <Modal open={!!showCreateDept} onClose={() => setShowCreateDept(null)} title="Add Department">
        <div className="space-y-3">
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Department name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
          />
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateDept(null)}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDept}
              disabled={!formName.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Team Modal */}
      <Modal open={!!showAssignTeam} onClose={() => setShowAssignTeam(null)} title="Assign Team to Department">
        <div className="space-y-3">
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
          >
            <option value="">Select a team...</option>
            {unassignedTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAssignTeam(null)}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignTeam}
              disabled={!selectedTeamId}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        </div>
      </Modal>

      {/* Move Department Modal */}
      <Modal
        open={!!moveDeptCtx}
        onClose={() => setMoveDeptCtx(null)}
        title={`Move "${moveDeptCtx?.name ?? ''}" to another organization`}
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <select
            value={moveTargetOrgId}
            onChange={(e) => setMoveTargetOrgId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
          >
            <option value="">Select target organization...</option>
            {organizations
              .filter((o) => o.id !== moveDeptCtx?.orgId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMoveDeptCtx(null)}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveDept}
              disabled={!moveTargetOrgId || isMoving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isMoving ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Move Team Modal */}
      <Modal
        open={!!moveTeamCtx}
        onClose={() => setMoveTeamCtx(null)}
        title={`Move "${moveTeamCtx?.teamName ?? ''}" to another department`}
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <select
            value={moveTeamTargetOrgId ? `${moveTeamTargetOrgId}::${moveTeamTargetDeptId}` : ''}
            onChange={(e) => {
              const [oId, dId] = e.target.value.split('::');
              setMoveTeamTargetOrgId(oId);
              setMoveTeamTargetDeptId(dId);
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
          >
            <option value="">Select target department...</option>
            {allDepartments
              .filter((d) => d.id !== moveTeamCtx?.deptId)
              .map((d) => (
                <option key={d.id} value={`${d.orgId}::${d.id}`}>
                  {d.orgName} / {d.name}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMoveTeamCtx(null)}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveTeam}
              disabled={!moveTeamTargetDeptId || isMovingTeam}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isMovingTeam ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Organization Confirmation */}
      <ConfirmDialog
        open={!!deleteOrgId}
        onClose={() => setDeleteOrgId(null)}
        onConfirm={handleDeleteOrg}
        title="Delete Organization"
        message="Are you sure you want to delete this organization? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      {/* Delete Department Confirmation */}
      <ConfirmDialog
        open={!!deleteDeptCtx}
        onClose={() => setDeleteDeptCtx(null)}
        onConfirm={handleDeleteDept}
        title="Delete Department"
        message={`Are you sure you want to delete "${deleteDeptCtx?.name ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
