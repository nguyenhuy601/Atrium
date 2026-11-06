import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SuiteShellLayout from './SuiteShellLayout';
import CompanySidebar from './CompanySidebar';
import { SpaceProvider, SPACE_KIND } from '../../context/SpaceContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOrgMyProfile } from '../../hooks/queries/useOrgMyProfile';
import { useOrgStructureNav } from '../../hooks/queries/useOrgStructure';
import { readStoredLastOrganizationId } from '../../utils/suitePathUtils';
import {
  COMPANY_SPACE_LEVEL,
  isCompanyStructureReadyForTeamCheck,
  readStoredCompanyTeamId,
  resolveCompanySpaceLevel,
  resolveMyDepartmentId,
} from '../../utils/companySpaceLevel';
import { toShellCompat } from '../../utils/orgShellCompat';

/** Company suite shell + SpaceContext (org + dept + optional team). */
export default function CompanySuiteLayout() {
  const { company, activeWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const organizationId = useMemo(
    () =>
      String(
        searchParams.get('organizationId') ||
          activeWorkspace?._id ||
          activeWorkspace?.id ||
          company?.id ||
          company?._id ||
          readStoredLastOrganizationId() ||
          ''
      ).trim(),
    [searchParams, activeWorkspace, company]
  );

  const profileQuery = useOrgMyProfile(organizationId, {
    enabled: Boolean(organizationId),
  });
  const structureNavQuery = useOrgStructureNav(organizationId, {
    enabled: Boolean(organizationId),
  });
  const shell = useMemo(
    () =>
      toShellCompat({
        profile: profileQuery.data || null,
        structureNav: Array.isArray(structureNavQuery.data)
          ? structureNavQuery.data
          : null,
      }),
    [profileQuery.data, structureNavQuery.data]
  );
  const shellQuery = {
    isLoading: profileQuery.isLoading || structureNavQuery.isLoading,
  };

  const departmentId = useMemo(() => {
    const fromUrl = String(searchParams.get('departmentId') || '').trim();
    const fromShell = resolveMyDepartmentId(shell);
    return fromUrl || fromShell || '';
  }, [searchParams, shell]);

  const teamIdFromUrl = String(searchParams.get('teamId') || '').trim();

  const forceDepartmentSpaceLevel = useMemo(() => {
    const path = String(location.pathname || '').replace(/\/+$/, '');
    if (!departmentId) return false;
    return path === '/company/documents' || path === '/company/calendar';
  }, [location.pathname, departmentId]);

  const resolved = useMemo(() => {
    if (forceDepartmentSpaceLevel) {
      return {
        level: COMPANY_SPACE_LEVEL.DEPARTMENT,
        departmentId,
        teamId: '',
      };
    }
    return resolveCompanySpaceLevel({
      shell,
      departmentId,
      teamIdFromUrl,
      teamIdFromStorage: readStoredCompanyTeamId(),
      preferTeam: false,
    });
  }, [shell, departmentId, teamIdFromUrl, forceDepartmentSpaceLevel]);

  const spaceDeptId = resolved.departmentId || departmentId;
  const structureReady = isCompanyStructureReadyForTeamCheck(shell, spaceDeptId);
  const holdUrlTeam =
    Boolean(teamIdFromUrl) &&
    !resolved.teamId &&
    (shellQuery.isLoading || !shell || !structureReady);
  const spaceTeamId = resolved.teamId || (holdUrlTeam ? teamIdFromUrl : '');
  const spaceLevel = spaceTeamId
    ? COMPANY_SPACE_LEVEL.TEAM
    : resolved.level;

  useEffect(() => {
    if (!organizationId || !spaceDeptId || shellQuery.isLoading || !shell) return;
    const currentDept = String(searchParams.get('departmentId') || '').trim();
    const currentTeam = String(searchParams.get('teamId') || '').trim();
    const hasOrgQuery = Boolean(searchParams.get('organizationId') || searchParams.get('orgId'));
    const wantTeam =
      spaceLevel === COMPANY_SPACE_LEVEL.TEAM ? String(spaceTeamId || '').trim() : '';
    const teamOk =
      spaceLevel !== COMPANY_SPACE_LEVEL.TEAM
        ? !currentTeam
        : currentTeam === wantTeam;
    if (forceDepartmentSpaceLevel && currentTeam) {
      const next = new URLSearchParams(searchParams);
      next.delete('organizationId');
      next.delete('orgId');
      next.set('departmentId', spaceDeptId);
      next.delete('teamId');
      const qs = next.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
      return;
    }
    if (currentDept === spaceDeptId && teamOk && !hasOrgQuery) return;

    const next = new URLSearchParams(searchParams);
    next.delete('organizationId');
    next.delete('orgId');
    next.set('departmentId', spaceDeptId);
    if (spaceLevel !== COMPANY_SPACE_LEVEL.TEAM) {
      next.delete('teamId');
    } else if (wantTeam) {
      next.set('teamId', wantTeam);
    }
    const qs = next.toString();
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
  }, [
    organizationId,
    spaceDeptId,
    spaceLevel,
    spaceTeamId,
    searchParams,
    location.pathname,
    navigate,
    shell,
    shellQuery.isLoading,
    structureReady,
    teamIdFromUrl,
    forceDepartmentSpaceLevel,
  ]);

  return (
    <SpaceProvider
      kind={SPACE_KIND.COMPANY}
      organizationId={organizationId}
      departmentId={spaceDeptId}
      teamId={spaceTeamId}
      level={spaceLevel}
    >
      <SuiteShellLayout sidebar={<CompanySidebar />} />
    </SpaceProvider>
  );
}
