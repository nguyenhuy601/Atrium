import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStrings } from '../../../locales/appStrings';
import { useTheme } from '../../../context/ThemeContext';
import { queryKeys } from '../../../lib/queryKeys';
import { coerceDeliveryPhase } from '../../../utils/projectPhaseNav';
import Phase2GateBanner from '../phase/Phase2GateBanner';
import { resolveHubCapabilities } from './hubCaps';
import { fetchProjectHubProject, STALE_PROJECT_HUB_MS } from './useProjectHubQueries';
import ProjectHubDeliveryPhasePanel from './ProjectHubDeliveryPhasePanel';

/**
 * Vận hành — chuyển giai đoạn giao hàng (không gắn Tổng quan).
 */
export default function ProjectDeliveryPhaseOpsPage() {
  const { t } = useAppStrings();
  const { isDarkMode } = useTheme();
  const { projectId: routeProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const projectId = String(routeProjectId || '').trim();
  const organizationId = String(searchParams.get('organizationId') || '').trim();

  const { data: projectPayload } = useQuery({
    queryKey: queryKeys.projectHub.project(projectId),
    queryFn: () => fetchProjectHubProject(projectId),
    enabled: Boolean(projectId),
    staleTime: STALE_PROJECT_HUB_MS,
    refetchOnMount: false,
  });

  const hubCaps = useMemo(() => resolveHubCapabilities(projectPayload), [projectPayload]);
  const deliveryPhase = coerceDeliveryPhase(projectPayload?.deliveryPhase);
  const orgId = String(
    projectPayload?.organizationId || organizationId || ''
  ).trim();

  return (
    <div className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {t('workspace.phaseNavDeliveryPhase')}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t('workspace.phaseDeliveryPhaseOpsHint')}
          </p>
        </header>

        <Phase2GateBanner
          projectId={projectId}
          organizationId={orgId}
          deliveryPhase={deliveryPhase}
          canChangePhase={Boolean(hubCaps?.canChangeDeliveryPhase)}
        />

        <ProjectHubDeliveryPhasePanel
          projectId={projectId}
          deliveryPhase={deliveryPhase}
          canChangePhase={Boolean(hubCaps?.canChangeDeliveryPhase)}
          canSignOffUat={Boolean(hubCaps?.canSignOffUat)}
          canAcceptHandover={Boolean(hubCaps?.canAcceptHandover)}
          isDarkMode={isDarkMode}
          handoverChecklist={projectPayload?.handoverChecklist || null}
          releaseLabel={projectPayload?.releaseLabel || ''}
          releaseReadyStatus={projectPayload?.releaseReadyStatus || 'none'}
          uatStatus={projectPayload?.uatStatus || 'none'}
          deployEvidence={projectPayload?.deployEvidence || null}
        />
      </div>
    </div>
  );
}
