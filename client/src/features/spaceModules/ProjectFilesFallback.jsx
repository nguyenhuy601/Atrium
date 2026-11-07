import { useQuery } from '@tanstack/react-query';
import { useAppStrings } from '../../locales/appStrings';
import { resolveApiErrorMessage } from '../../utils/resolveApiErrorMessage';
import { projectAPI } from '../../services/api/projectAPI';
import { queryKeys } from '../../lib/queryKeys';
import OrganizationDocumentsWorkspacePanel from '../orgDocuments/OrganizationDocumentsWorkspacePanel';
import { useLibraryDocuments } from '../orgDocuments/useLibraryDocuments';

function unwrapFiles(res) {
  const body = res?.data?.data ?? res?.data ?? res;
  if (Array.isArray(body?.files)) return body.files;
  if (Array.isArray(body)) return body;
  return [];
}

function mapProjectAttachmentToFile(row, t) {
  const url = String(row?.url || '').trim();
  const name = String(row?.name || url || t('common.untitled') || 'file').trim();
  return {
    id: `task-file:${url}:${name}`,
    name,
    url,
    size: row?.size || null,
    uploadedAt: row?.uploadedAt || null,
    source: 'project_task',
    taskTitle: row?.taskTitle || '',
  };
}

/**
 * Kho dự án — library GET /documents?projectId= + tệp đính kèm task (files:view).
 */
export default function ProjectFilesFallback({ projectId = '', organizationId = '' } = {}) {
  const { t } = useAppStrings();
  const pid = String(projectId || '').trim();
  const orgId = String(organizationId || '').trim();
  const libraryQuery = useLibraryDocuments({
    organizationId: orgId,
    projectId: pid,
    enabled: Boolean(pid),
  });

  const taskFilesQuery = useQuery({
    queryKey: queryKeys.projectHub.files(pid),
    queryFn: async () => unwrapFiles(await projectAPI.getFiles(pid)),
    enabled: Boolean(pid),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });

  const libraryError = libraryQuery.isError
    ? resolveApiErrorMessage(libraryQuery.error, {
        t,
        fallback: t('documents.loadFail'),
      })
    : '';
  const taskFiles = (taskFilesQuery.data || []).map((row) => mapProjectAttachmentToFile(row, t));
  const libraryFiles = libraryQuery.files || [];
  const files = [...libraryFiles, ...taskFiles];
  const loading = libraryQuery.isLoading || taskFilesQuery.isLoading;
  const error =
    libraryError && !files.length
      ? libraryError
      : taskFilesQuery.isError && !files.length
        ? resolveApiErrorMessage(taskFilesQuery.error, {
            t,
            fallback: t('documents.loadFail'),
          })
        : '';

  return (
    <div className="h-full min-h-0">
      <OrganizationDocumentsWorkspacePanel
        files={files}
        loading={loading}
        error={error}
        onReload={() => {
          libraryQuery.reload();
          void taskFilesQuery.refetch();
        }}
        organizationId={orgId}
        projectId={pid}
        panelTitle={t('documents.driveTitleProject')}
        scopeHint={t('documents.driveHintProject')}
      />
    </div>
  );
}
