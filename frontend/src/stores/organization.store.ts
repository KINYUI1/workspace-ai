import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';

// --- Local interfaces --------------------------------------------------------

interface Department {
  id: string;
  name: string;
  description: string;
  teams: {
    id: string;
    name: string;
    agents: { id: string; name: string; role: string; status: string }[];
  }[];
}

interface Organization {
  id: string;
  name: string;
  description: string;
  departments: Department[];
}

interface OrgState {
  organizations: Organization[];
  isLoading: boolean;

  fetchOrganizations: () => Promise<void>;
  createOrganization: (dto: { name: string; description?: string }) => Promise<void>;
  deleteOrganization: (orgId: string) => Promise<void>;
  createDepartment: (
    orgId: string,
    dto: { name: string; description?: string },
  ) => Promise<void>;
  deleteDepartment: (orgId: string, deptId: string) => Promise<void>;
  moveDepartment: (orgId: string, deptId: string, targetOrgId: string) => Promise<void>;
  assignTeamToDepartment: (
    orgId: string,
    deptId: string,
    teamId: string,
  ) => Promise<void>;
  removeTeamFromDepartment: (
    orgId: string,
    deptId: string,
    teamId: string,
  ) => Promise<void>;
}

// --- Store -------------------------------------------------------------------

export const useOrganizationStore = create<OrgState>((set, get) => ({
  organizations: [],
  isLoading: false,

  fetchOrganizations: async () => {
    const cached = await getCached<Organization[]>('organizations');
    if (cached) set({ organizations: cached.data });

    set({ isLoading: !cached });
    try {
      const res = await api.getOrganizations(1, 50);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orgs = (res.data ?? []).map((o: any) => ({
        ...o,
        departments: (o.departments ?? []).map((d: any) => ({
          ...d,
          teams: (d.teams ?? []).map((t: any) => ({ ...t, agents: t.agents ?? [] })),
        })),
      }));
      set({ organizations: orgs as Organization[], isLoading: false });
      await setCache('organizations', orgs);
    } catch {
      set({ isLoading: false });
    }
  },

  createOrganization: async (dto) => {
    const res = await api.createOrganization(dto);
    if (res.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = { ...(res.data as any), departments: [] } as Organization;
      const organizations = [...get().organizations, org];
      set({ organizations });
      await setCache('organizations', organizations);
    }
  },

  deleteOrganization: async (orgId) => {
    await api.deleteOrganization(orgId);
    const organizations = get().organizations.filter((o) => o.id !== orgId);
    set({ organizations });
    await setCache('organizations', organizations);
  },

  createDepartment: async (orgId, dto) => {
    const res = await api.createDepartment(orgId, dto);
    if (res.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dept = { ...(res.data as any), teams: [] } as Department;
      const organizations = get().organizations.map((org) =>
        org.id === orgId
          ? { ...org, departments: [...(org.departments ?? []), dept] }
          : org,
      );
      set({ organizations });
      await setCache('organizations', organizations);
    }
  },

  deleteDepartment: async (orgId, deptId) => {
    await api.deleteDepartment(orgId, deptId);
    const organizations = get().organizations.map((org) =>
      org.id === orgId
        ? { ...org, departments: org.departments.filter((d) => d.id !== deptId) }
        : org,
    );
    set({ organizations });
    await setCache('organizations', organizations);
  },

  moveDepartment: async (orgId, deptId, targetOrgId) => {
    await api.moveDepartment(orgId, deptId, targetOrgId);
    await get().fetchOrganizations();
  },

  assignTeamToDepartment: async (orgId, deptId, teamId) => {
    await api.assignTeamToDepartment(orgId, deptId, teamId);
    await get().fetchOrganizations();
  },

  removeTeamFromDepartment: async (orgId, deptId, teamId) => {
    await api.removeTeamFromDepartment(orgId, deptId, teamId);
    await get().fetchOrganizations();
  },
}));

export type { Organization, Department, OrgState };
