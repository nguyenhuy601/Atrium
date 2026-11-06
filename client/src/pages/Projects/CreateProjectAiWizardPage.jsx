import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import CreateProjectAiWizard from '../../features/projects/aiWizard/CreateProjectAiWizard';
import {
  buildCollaborateProjectsPath,
  buildProjectsModulePath,
  buildProjectsNewPath,
  buildProjectsPickerPath,
  readStoredLastOrganizationId,
} from '../../utils/suitePathUtils';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAppStrings } from '../../locales/appStrings';
import { wizardUi } from '../../features/projects/wizard/projectWizardUi';
import { queryKeys } from '../../lib/queryKeys';
import useTaskWorkspaceScope from '../../hooks/useTaskWorkspaceScope';

/**
 * Phase 2 HOW — AI on an existing Phase 1 project (`?projectId=&packId=`).
 * Without projectId → AI birth wizard (`/new?analysisMode=ai`).
 */
export default function CreateProjectAiWizardPage() {
  const { t } = useAppStrings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { company, activeWorkspace, lastOrganizationId } = useWorkspace();

  const organizationId = useMemo(() => {
    const fromQuery = String(params.get('organizationId') || params.get('orgId') || '').trim();
    if (fromQuery) return fromQuery;
    return String(
      company?.id ||
        company?._id ||
        activeWorkspace?._id ||
        activeWorkspace?.id ||
        lastOrganizationId ||
        readStoredLastOrganizationId() ||
        ''
    ).trim();
  }, [params, company, activeWorkspace, lastOrganizationId]);

  const projectId = String(params.get('projectId') || '').trim();
  const packId = String(params.get('packId') || '').trim();
  const deniedToastRef = useRef(false);

  const {
    canCreateProjectCapability,
    createProjectDeniedKey,
    loading: scopeLoading,
  } = useTaskWorkspaceScope(organizationId);

  useEffect(() => {
    if (projectId || !organizationId || scopeLoading || canCreateProjectCapability) return;
    if (deniedToastRef.current) return;
    deniedToastRef.current = true;
    toast.error(t(createProjectDeniedKey));
  }, [
    projectId,
    organizationId,
    scopeLoading,
    canCreateProjectCapability,
    createProjectDeniedKey,
    t,
  ]);

  if (!organizationId) {
    return (
      <div className={wizardUi.emptyPage}>
        <p className="text-sm text-muted-foreground">
          {t('organizations.selectOrgFirst')}
        </p>
        <Link to={buildCollaborateProjectsPath()} className={wizardUi.link}>
          {t('adminTasks.wizardBackToHub')}
        </Link>
      </div>
    );
  }

  if (!projectId) {
    if (scopeLoading) {
      return (
        <div className={wizardUi.emptyPage}>
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      );
    }
    if (!canCreateProjectCapability) {
      return <Navigate to={buildProjectsPickerPath()} replace />;
    }
    return <Navigate to={buildProjectsNewPath(organizationId, { analysisMode: 'ai' })} replace />;
  }

  const cancelTarget = buildProjectsModulePath(projectId, 'overview');
  const backLabel = t('workspace.phase2AiBackToProject');

  const onCancel = () => navigate(cancelTarget);

  const onCreated = (result) => {
    if (organizationId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.listAll(organizationId),
      });
    }
    const pid = String(
      result?.projectId || result?.project?._id || projectId || ''
    ).trim();
    const boardId = String(
      result?.defaultBoardId ||
        result?.project?.defaultBoardId ||
        result?.boardId ||
        ''
    ).trim();
    navigate(
      buildProjectsModulePath(pid, 'overview', {
        boardId,
      })
    );
  };

  return (
    <CreateProjectAiWizard
      organizationId={organizationId}
      existingProjectId={projectId}
      initialPackId={packId}
      backLabel={backLabel}
      onCancel={onCancel}
      onCreated={onCreated}
    />
  );
}
