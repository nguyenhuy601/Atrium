import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import FigmaNavigationSidebar from './FigmaNavigationSidebar';
import CompanyContextSwitch from './CompanyContextSwitch';
import CompanyTeamPickerModal from './CompanyTeamPickerModal';
import { useSpace } from '../../context/SpaceContext';
import { useOrgMyProfile } from '../../hooks/queries/useOrgMyProfile';
import { useOrgStructureNav } from '../../hooks/queries/useOrgStructure';
import {
  COMPANY_SPACE_LEVEL,
  listMyTeamsFromShell,
  resolveDepartmentLabel,
  resolveTeamLabel,
  writeStoredCompanyTeamId,
} from '../../utils/companySpaceLevel';
import { toShellCompat } from '../../utils/orgShellCompat';
import { buildCompanyHomePath } from '../../utils/suitePathUtils';

/** Company Space suite sidebar + L2 dept/team switch. */
export default function CompanySidebar({ landingDemo = false } = {}) {
  const space = useSpace();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const organizationId = space?.organizationId || '';
  const departmentId = space?.departmentId || '';
  const teamId = space?.teamId || '';
  const level = space?.level || COMPANY_SPACE_LEVEL.DEPARTMENT;

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

  const teams = useMemo(
    () => listMyTeamsFromShell(shell, departmentId),
    [shell, departmentId]
  );

  const departmentLabel = resolveDepartmentLabel(shell, departmentId);
  const teamLabel = resolveTeamLabel(shell, teamId);

  const patchSearch = useCallback(
    ({ nextTeamId = null, clearTeam = false } = {}) => {
      const next = new URLSearchParams(searchParams);
      // organizationId stays in WorkspaceContext — do not write to URL (avoids set/delete cycle).
      next.delete('organizationId');
      next.delete('orgId');
      if (departmentId) next.set('departmentId', departmentId);
      if (clearTeam) {
        next.delete('teamId');
        next.delete('channelId');
        writeStoredCompanyTeamId('');
      } else if (nextTeamId) {
        next.set('teamId', String(nextTeamId));
        next.delete('channelId');
        writeStoredCompanyTeamId(nextTeamId);
      }
      const pathname =
        location.pathname.startsWith('/company')
          ? location.pathname
          : buildCompanyHomePath({ organizationId, departmentId }).split('?')[0];
      navigate({ pathname, search: `?${next.toString()}` });
    },
    [searchParams, organizationId, departmentId, location.pathname, navigate]
  );

  const onSelectDepartment = useCallback(() => {
    patchSearch({ clearTeam: true });
    setPickerOpen(false);
  }, [patchSearch]);

  const onSelectTeam = useCallback(
    (team) => {
      if (!team?.id) return;
      patchSearch({ nextTeamId: team.id });
      setPickerOpen(false);
    },
    [patchSearch]
  );

  return (
    <>
      <FigmaNavigationSidebar
        suite="company"
        landingDemo={landingDemo}
        contextSwitch={
          <CompanyContextSwitch
            level={level}
            departmentLabel={departmentLabel}
            teamLabel={teamLabel}
            onSelectDepartment={onSelectDepartment}
            onOpenTeamPicker={() => setPickerOpen(true)}
          />
        }
      />
      <CompanyTeamPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        teams={teams}
        selectedTeamId={teamId}
        onSelect={onSelectTeam}
      />
    </>
  );
}
