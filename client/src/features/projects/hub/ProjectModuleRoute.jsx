import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Suspense, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { VH_MOTION_SPINNER } from '../../../motion/classes';
import toast from 'react-hot-toast';
import ProjectHubPage from '../../../pages/Projects/ProjectHubPage';

import SpaceCalendarModule from '../../spaceModules/SpaceCalendarModule';
import SpaceDocumentsModule from '../../spaceModules/SpaceDocumentsModule';
import SpaceProjectChatModule from '../../spaceModules/SpaceProjectChatModule';
import ProjectMeetingsPanel from './ProjectMeetingsPanel';
import Phase1Shell from '../phase1/Phase1Shell';
import Phase4Shell from './phase4/Phase4Shell';
import ProjectDeliveryPhaseOpsPage from './ProjectDeliveryPhaseOpsPage';
import { isPhase4DeliveryPhase } from './phase4/phase4Ui';
import { MODULE_TO_HUB_TAB, normalizeProjectModule } from '../../../utils/suiteNavConfig';
import {
  coerceDeliveryPhase,
  isModuleAllowedForPhase,
  isPhase1DeliveryPhase,
  phaseHomeModule,
} from '../../../utils/projectPhaseNav';
import { resolveHubCapabilities } from './hubCaps';
import { lazyWithRetry } from '../../../utils/lazyWithRetry';

const ProjectClosureReportPage = lazyWithRetry(() => import('./reports/ProjectClosureReportPage'));
import {
  ARTIFACT_KIND_BY_MODULE,
  PLANNING_KIND_BY_MODULE,
  PLANNING_SUB_TO_MODULE,
} from '../phase1/nav/phase1NavConfig';
import {
  buildProjectsModulePath,
  buildProjectsPickerPath,
  resolveProjectOrganizationId,
  writeStoredLastOrganizationId,
} from '../../../utils/suitePathUtils';
import { writeStoredLastProjectId } from '../picker/projectPickerRemember';
import { SpaceProvider, SPACE_KIND } from '../../../context/SpaceContext';
import { fetchProjectHubProject, STALE_PROJECT_HUB_MS } from './useProjectHubQueries';
import { queryKeys } from '../../../lib/queryKeys';
import { useAppStrings } from '../../../locales/appStrings';
import { AdminLoadErrorState } from '../../../components/adminUsers/adminPanelStates';
import { isProjectMembershipDenied } from '../../../config/routeDeniedNotice';
import { resolveApiErrorMessage } from '../../../utils/resolveApiErrorMessage';
import { isAiHitlIncomplete, resolveAiProjectEntryPath } from '../phase1/aiHitl/aiHitlNavState';
import {
  aiHitlNavLinkedPackQueryKey,
  loadLinkedPackForAiNav,
} from '../phase1/aiHitl/loadLinkedPackForAiNav';
import {
  canAccessProjectModule,
  isAiHitlCollabOpsModule,
  shouldDenyProjectEntry,
} from './projectEntryGuard';
import ProjectRoleDeniedRedirect from '../ProjectRoleDeniedRedirect';

const PHASE1_MODULES = new Set([
  'overview',
  'customer-documents',
  'analysis-bg',
  'analysis-br',
  'analysis-bpm',
  'analysis-fr',
  'analysis-uc',
  'analysis-nfr',
  'analysis-scope',
  'traceability',
  'analysis-reviews',
  'srs-baselines',
  'ai-hitl',
  ...Object.keys(ARTIFACT_KIND_BY_MODULE),
  ...Object.keys(PLANNING_KIND_BY_MODULE),
  ...Object.values(PLANNING_SUB_TO_MODULE),
]);

/**
 * Route /app/projects/:projectId/:module — data always scoped to projectId.
 * Phase 1 delivery phases render Phase1Shell for analysis/planning modules.
 */
export default function ProjectModuleRoute() {
  const { projectId: projectIdParam, module: moduleParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = String(projectIdParam || '').trim();
  const module = normalizeProjectModule(moduleParam);

  const { t } = useAppStrings();
  const {
    data: projectRow,
    isPending: projectPending,
    isError: projectError,
    error: projectLoadError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: queryKeys.projectHub.project(projectId),
    queryFn: () => fetchProjectHubProject(projectId),
    enabled: Boolean(projectId),
    staleTime: STALE_PROJECT_HUB_MS,
    refetchOnMount: false,
  });
  // Only coerce after row exists — loading must not imply development (Phase 2 hub flash).
  const deliveryPhase = projectRow ? coerceDeliveryPhase(projectRow.deliveryPhase) : null;
  const orgId = resolveProjectOrganizationId({
    search: searchParams,
    projectRow,
  });

  const needsAiHitlGuard =
    Boolean(projectRow && orgId) &&
    (deliveryPhase === 'requirement_analysis' || !projectRow?.deliveryPhase);

  const { data: linkedPack, isPending: packPending } = useQuery({
    queryKey: aiHitlNavLinkedPackQueryKey(orgId, projectId),
    queryFn: () => loadLinkedPackForAiNav(orgId, projectId),
    enabled: needsAiHitlGuard,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (projectId) writeStoredLastProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (orgId) writeStoredLastOrganizationId(orgId);
  }, [orgId]);

  const phaseRedirectToastRef = useRef('');
  useEffect(() => {
    if (!projectRow || module === 'ai-hitl') return;
    if (
      isModuleAllowedForPhase(module, deliveryPhase, {
        projectStatus: projectRow?.status,
      })
    ) {
      return;
    }
    const home = phaseHomeModule(deliveryPhase);
    const key = `${projectId}:${module}:${home}`;
    if (phaseRedirectToastRef.current === key) return;
    phaseRedirectToastRef.current = key;
    toast(t('nav.projectPhaseModuleRedirect'), { id: 'project-phase-module-redirect' });
  }, [projectRow, module, deliveryPhase, projectId, t]);

  const onModuleChange = useCallback(
    (tabId) => {
      navigate(
        buildProjectsModulePath(projectId, tabId, {
          boardId: searchParams.get('boardId') || '',
        })
      );
    },
    [navigate, projectId, searchParams]
  );

  const onSwitchProject = useCallback(() => {
    navigate(buildProjectsPickerPath(orgId));
  }, [navigate, orgId]);

  if (!projectId) {
    return <Navigate to={buildProjectsPickerPath(orgId)} replace />;
  }

  if (projectPending && !projectRow) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (projectError && !projectRow) {
    if (isProjectMembershipDenied(projectLoadError)) {
      return (
        <Navigate
          to={buildProjectsPickerPath(orgId)}
          replace
          state={{ routeDenied: 'project' }}
        />
      );
    }
    return (
      <div className="flex min-h-[12rem] items-center justify-center p-6">
        <AdminLoadErrorState
          message={resolveApiErrorMessage(projectLoadError, {
            t,
            fallback: t('workspace.projectsLoadFail'),
          })}
          onRetry={() => void refetchProject()}
        />
      </div>
    );
  }

  if (
    shouldDenyProjectEntry({
      projectRow,
      isError: projectError,
      error: projectLoadError,
    })
  ) {
    return <ProjectRoleDeniedRedirect projectId={projectId} orgId={orgId} />;
  }

  // Thiếu quyền view module → không vào được (ẩn nav ở filterNavItemsByCapabilities).
  // Có view: vào xem dữ liệu; edit/manage vẫn gate ở nút/API theo canEdit*/canManage*.
  if (projectRow && !canAccessProjectModule(module, projectRow.capabilities)) {
    const home = deliveryPhase ? phaseHomeModule(deliveryPhase) : 'overview';
    return <Navigate to={buildProjectsModulePath(projectId, home)} replace />;
  }

  if (needsAiHitlGuard && packPending && linkedPack === undefined) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  const aiHitlIncomplete =
    Boolean(projectRow) &&
    isAiHitlIncomplete({ project: projectRow, pack: linkedPack || null });

  // Incomplete AI → stay on ai-hitl; still allow Collaboration/Operations modules.
  if (aiHitlIncomplete && !isAiHitlCollabOpsModule(module)) {
    const hitlPath = resolveAiProjectEntryPath({
      projectId,
      project: projectRow,
      pack: linkedPack || null,
      boardId: searchParams.get('boardId') || '',
      organizationId: orgId,
    });
    return <Navigate to={hitlPath} replace />;
  }

  if (
    projectRow &&
    module !== 'ai-hitl' &&
    !isModuleAllowedForPhase(module, deliveryPhase, {
      projectStatus: projectRow?.status,
    })
  ) {
    return (
      <Navigate to={buildProjectsModulePath(projectId, phaseHomeModule(deliveryPhase))} replace />
    );
  }

  if (projectRow && module === 'reports') {
    const reportCaps = resolveHubCapabilities(projectRow);
    if (!reportCaps.canViewReport) {
      return (
        <Navigate to={buildProjectsModulePath(projectId, phaseHomeModule(deliveryPhase))} replace />
      );
    }
  }

  if (
    projectRow &&
    (module === 'ai-hitl' || isPhase1DeliveryPhase(deliveryPhase)) &&
    (PHASE1_MODULES.has(module) ||
      module === 'overview' ||
      module === 'chat' ||
      module === 'calendar' ||
      module === 'documents' ||
      module === 'members' ||
      module === 'settings' ||
      module === 'delivery-phase')
  ) {
    return <Phase1Shell module={module} />;
  }

  if (projectRow && isPhase4DeliveryPhase(deliveryPhase)) {
    return <Phase4Shell module={module} />;
  }

  const hubTab = MODULE_TO_HUB_TAB[module] || null;

  let body = null;
  if (module === 'delivery-phase') {
    body = <ProjectDeliveryPhaseOpsPage />;
  } else if (module === 'reports') {
    body = (
      <Suspense
        fallback={
          <div className="flex min-h-[12rem] items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        }
      >
        <ProjectClosureReportPage projectId={projectId} />
      </Suspense>
    );
  } else if (module === 'chat') {
    body = <SpaceProjectChatModule />;
  } else if (module === 'calendar') {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3 sm:p-4">
        <ProjectMeetingsPanel projectId={projectId} />
        <SpaceCalendarModule />
      </div>
    );
  } else if (module === 'documents') {
    body = <SpaceDocumentsModule />;
  } else if (hubTab) {
    body = (
      <ProjectHubPage
        controlledModule={hubTab}
        hideTabBar
        onModuleChange={onModuleChange}
        onSwitchProject={onSwitchProject}
      />
    );
  } else {
    body = <Navigate to={buildProjectsModulePath(projectId, 'overview')} replace />;
  }

  return (
    <SpaceProvider kind={SPACE_KIND.PROJECT} organizationId={orgId} projectId={projectId}>
      {body}
    </SpaceProvider>
  );
}
