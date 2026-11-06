import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOrganizationsMy } from '../../hooks/queries/useOrganizationsMy';
import { useOrgMyProfile } from '../../hooks/queries/useOrgMyProfile';
import { useAppStrings } from '../../locales/appStrings';
import { projectAPI } from '../../services/api/projectAPI';
import userService from '../../services/userService';
import { getResolvedBearerToken } from '../../utils/tokenStorage';
import {
  filterMyProjects,
  mergePersonalOrgRoles,
  resolvePlacementFromProfile,
} from './personalOverviewUtils';

function unwrapList(payload) {
  const raw = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.projects)) return raw.projects;
  return [];
}

function resolveOrgId(company, orgs) {
  const fromCompany = String(company?.id || company?._id || company?.organizationId || '').trim();
  if (fromCompany) return fromCompany;
  const first = Array.isArray(orgs) ? orgs[0] : null;
  return String(first?._id || first?.id || first?.organizationId || '').trim();
}

/**
 * Loads personal overview: profile, placement, org roles (from my-profile), my projects.
 * Không gọi /org-role-assignments (admin-only → 403 với member).
 */
export function usePersonalOverviewData({ enabled = true } = {}) {
  const { t } = useAppStrings();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { company } = useWorkspace();
  const orgsQuery = useOrganizationsMy({ enabled });
  const orgs = orgsQuery.data || [];
  const orgId = resolveOrgId(company, orgs);
  const authReady = Boolean(getResolvedBearerToken());
  const userId = String(user?.userId || user?._id || user?.id || '').trim();
  const ready = enabled && !authLoading && isAuthenticated && authReady;

  const orgProfileQuery = useOrgMyProfile(orgId, {
    enabled: ready && Boolean(orgId),
    include: 'organization',
  });

  const profileQuery = useQuery({
    queryKey: ['personalOverview', 'profile', userId],
    queryFn: async () => {
      const res = await userService.getMe();
      return res?.data?.data ?? res?.data ?? res;
    },
    enabled: ready && Boolean(userId),
    staleTime: 60_000,
    retry: 1,
  });

  const projectsQuery = useQuery({
    queryKey: ['personalOverview', 'projects', orgId, userId],
    queryFn: async () => {
      const res = await projectAPI.list({ organizationId: orgId });
      return unwrapList(res);
    },
    enabled: ready && Boolean(orgId) && Boolean(userId),
    staleTime: 60_000,
    retry: 1,
  });

  const orgProfile = orgProfileQuery.data || null;
  const profile = profileQuery.data || null;

  const placement = useMemo(
    () => resolvePlacementFromProfile(orgProfile),
    [orgProfile]
  );

  const catalogOrgRoles = useMemo(() => {
    const rows = orgProfile?.myOrganizationRoles;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      roleKey: String(r?.roleKey || r?.key || '').trim(),
      roleLabel: String(r?.roleLabel || r?.label || '').trim(),
      label: String(r?.roleLabel || r?.label || '').trim(),
    })).filter((r) => r.roleKey);
  }, [orgProfile]);

  const orgRoles = useMemo(
    () =>
      mergePersonalOrgRoles({
        assignments: catalogOrgRoles,
        structureRoles: placement.structureRoles || [],
        t,
      }),
    [catalogOrgRoles, placement.structureRoles, t]
  );

  const myProjects = useMemo(
    () => filterMyProjects(projectsQuery.data || []),
    [projectsQuery.data]
  );

  const orgMeta = useMemo(() => {
    const fromProfile = orgProfile?.organization || {};
    const matched = (Array.isArray(orgs) ? orgs : []).find(
      (o) => String(o._id || o.id) === orgId
    );
    return {
      orgId,
      orgName:
        String(fromProfile.name || matched?.name || company?.name || '').trim() || '—',
      membershipRole:
        String(orgProfile?.myRole || matched?.myRole || matched?.role || '').trim() || '',
      myStructureRole: String(matched?.myStructureRole || '').trim() || '',
    };
  }, [orgProfile, orgs, orgId, company]);

  const displayProfile = useMemo(() => {
    const displayName =
      profile?.displayName ||
      profile?.fullName ||
      user?.displayName ||
      user?.fullName ||
      user?.name ||
      user?.username ||
      '—';
    const email = String(profile?.email || user?.email || '').trim();
    const avatar = profile?.avatar || user?.avatar || null;
    return { displayName, email, avatar, userId };
  }, [profile, user, userId]);

  const loading =
    ready &&
    (orgsQuery.isLoading ||
      (Boolean(orgId) && orgProfileQuery.isLoading) ||
      profileQuery.isLoading ||
      (Boolean(orgId) && projectsQuery.isLoading));

  return {
    loading,
    orgId,
    displayProfile,
    orgMeta,
    placement,
    orgRoles,
    myProjects,
    errors: {
      shell: orgProfileQuery.isError,
      assignments: false,
      projects: projectsQuery.isError,
      profile: profileQuery.isError,
    },
  };
}

export default usePersonalOverviewData;
