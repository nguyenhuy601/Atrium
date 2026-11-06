import { useMemo } from 'react';
import { useAppStrings } from '../../locales/appStrings';
import { useSpace } from '../../context/SpaceContext';
import { useOrgMyProfile } from '../../hooks/queries/useOrgMyProfile';
import { useOrgStructureNav } from '../../hooks/queries/useOrgStructure';
import { useOrganizationDocumentsOverview } from '../../hooks/queries/useOrganizationDocumentsOverview';
import { COMPANY_SPACE_LEVEL } from '../../utils/companySpaceLevel';
import { toShellCompat } from '../../utils/orgShellCompat';
import {
  buildCompanyChatPath,
  buildCompanyDocumentsPath,
  buildCompanyWorkspacePath,
} from '../../utils/suitePathUtils';
import { buildCompanyHomeViewModel } from './companyHomeMetrics';

/**
 * Aggregate company home data from my-profile + structure?view=nav.
 * Modules mirror getCompanyNavItems (chat + documents only).
 */
export function useCompanyHomeData() {
  const { t } = useAppStrings();
  const space = useSpace();
  const organizationId = space?.organizationId || '';
  const departmentId = space?.departmentId || '';
  const teamId = space?.teamId || '';
  const level = space?.level || COMPANY_SPACE_LEVEL.DEPARTMENT;
  const isTeamLevel = level === COMPANY_SPACE_LEVEL.TEAM && Boolean(teamId);

  const profileQuery = useOrgMyProfile(organizationId, {
    enabled: Boolean(organizationId),
  });
  const structureNavQuery = useOrgStructureNav(organizationId, {
    enabled: Boolean(organizationId),
  });
  const docsQuery = useOrganizationDocumentsOverview(organizationId, {
    enabled: Boolean(organizationId) && Boolean(departmentId),
    departmentId,
    teamId: isTeamLevel ? teamId : '',
    view: 'summary',
  });

  const shellCompat = useMemo(
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
    data: shellCompat,
    isLoading: profileQuery.isLoading || structureNavQuery.isLoading,
    isError: profileQuery.isError || structureNavQuery.isError,
    error: profileQuery.error || structureNavQuery.error,
    refetch: () => {
      profileQuery.refetch();
      structureNavQuery.refetch();
    },
  };

  const labels = useMemo(
    () => ({
      homeFallback: t('nav.companyHome'),
      teamFallback: t('nav.companyLevelTeam'),
      deptSub: t('nav.companyHomeDeptSub'),
      teamSub: (dept) => t('nav.companyHomeTeamSub', { department: dept }),
      pulseTeams: t('nav.companyHomePulseTeams'),
      pulseDocs: t('nav.companyHomePulseDocs'),
      distTeams: t('nav.companyHomeDistTeams'),
      distDocs: t('nav.companyHomeDistDocs'),
    }),
    [t]
  );

  const documentCount = useMemo(() => {
    if (!docsQuery.isSuccess) return null;
    const n = Number(docsQuery.documentCount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [docsQuery.isSuccess, docsQuery.documentCount]);

  const viewModel = useMemo(
    () =>
      buildCompanyHomeViewModel({
        shell: shellCompat,
        departmentId,
        teamId,
        level,
        documentCount,
        labels,
      }),
    [shellCompat, departmentId, teamId, level, documentCount, labels]
  );

  const paths = useMemo(() => {
    const chatPath = buildCompanyChatPath(organizationId, {
      departmentId,
      teamId: isTeamLevel ? teamId : '',
      tab: isTeamLevel ? 'chat' : 'announcement',
    });
    const docsPath = buildCompanyDocumentsPath(organizationId, {
      departmentId,
      teamId: isTeamLevel ? teamId : '',
    });
    const workspacesPath = buildCompanyWorkspacePath({ organizationId, departmentId });
    return { chatPath, docsPath, workspacesPath };
  }, [organizationId, departmentId, teamId, isTeamLevel]);

  return {
    organizationId,
    departmentId,
    teamId,
    level,
    shellQuery,
    docsQuery,
    viewModel,
    paths,
    refetchAll: () => {
      shellQuery.refetch();
      if (departmentId) docsQuery.refetch();
    },
  };
}
