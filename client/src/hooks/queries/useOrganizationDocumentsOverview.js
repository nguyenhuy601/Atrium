import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_ORGS_MS } from '../../lib/queryClient';
import { organizationAPI } from '../../services/api/organizationAPI';
import { getResolvedBearerToken } from '../../utils/tokenStorage';
import {
  flattenChannelsFromStructure,
  mapLibraryDocumentToOrgFile,
  mapMessageToOrgFile,
  unwrapApiPayload,
} from '../../features/orgDocuments/orgDocumentUtils';
import { useAppStrings } from '../../locales/appStrings';

const unwrapOverview = (payload) => {
  const raw = unwrapApiPayload(payload);
  return raw?.data ?? raw;
};

/** Chuẩn hoá kênh từ GET /channels hoặc overview.channels. */
function channelMetaFromLiveList(channels) {
  const list = [];
  for (const ch of channels || []) {
    const id = String(ch?._id || ch?.id || '').trim();
    if (!id) continue;
    const departmentId = String(ch?.department || ch?.departmentId || '').trim();
    const teamId = String(ch?.team || ch?.teamId || '').trim();
    list.push({
      _id: id,
      id,
      name: String(ch?.name || ch?.title || id),
      type: String(ch?.type || 'chat').toLowerCase(),
      department: departmentId,
      departmentId,
      team: teamId,
      teamId,
    });
  }
  return list;
}

/** Map payload documents-overview → danh sách file (hook + loadWorkspaceDocuments). */
export function buildOrgFilesFromOverview(overview, t, locale, options = {}) {
  if (!overview) return [];
  const fromOverviewChannels = channelMetaFromLiveList(overview.channels);
  const branches = Array.isArray(overview.branches) ? overview.branches : [];
  const fromStructure = flattenChannelsFromStructure(branches);
  const fromLive = channelMetaFromLiveList(options.channels);
  const channelByRoomId = new Map();
  for (const ch of [...fromOverviewChannels, ...fromStructure, ...fromLive]) {
    if (!channelByRoomId.has(ch._id)) channelByRoomId.set(ch._id, ch);
  }
  const messages = Array.isArray(overview.attachmentMessages) ? overview.attachmentMessages : [];
  const attachmentFiles = messages.map((m) => mapMessageToOrgFile(m, channelByRoomId, t, locale));
  const libraryList = Array.isArray(overview.libraryDocuments) ? overview.libraryDocuments : [];
  const libraryFiles = libraryList.map((doc) => mapLibraryDocumentToOrgFile(doc, t, locale));
  return [...attachmentFiles, ...libraryFiles].sort((a, b) => {
    const ta = new Date(a.raw?.createdAt || a.raw?.updatedAt || 0).getTime();
    const tb = new Date(b.raw?.createdAt || b.raw?.updatedAt || 0).getTime();
    return tb - ta;
  });
}

/** Gọi REST documents-overview — JWT do apiClient interceptor gắn. */
export async function fetchOrganizationDocumentsOverview(orgId, scope = {}) {
  const id = orgId ? String(orgId) : '';
  if (!id) return null;
  const departmentId = String(scope.departmentId || '').trim();
  const teamId = String(scope.teamId || '').trim();
  const view = String(scope.view || '').trim().toLowerCase();
  const payload = await organizationAPI.getDocumentsOverview(id, {
    ...(departmentId ? { departmentId } : {}),
    ...(teamId ? { teamId } : {}),
    ...(view === 'summary' || view === 'full' ? { view } : {}),
  });
  return unwrapOverview(payload);
}

export function useOrganizationDocumentsOverview(
  organizationId,
  { enabled: enabledProp = true, departmentId = '', teamId = '', view = 'full' } = {}
) {
  const { t, locale } = useAppStrings();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const id = organizationId ? String(organizationId) : '';
  const deptId = String(departmentId || '').trim();
  const tid = String(teamId || '').trim();
  const viewMode = String(view || 'full').trim().toLowerCase() === 'summary' ? 'summary' : 'full';
  const authReady = Boolean(getResolvedBearerToken());

  const query = useQuery({
    queryKey: [
      ...queryKeys.org.documentsOverview(id, deptId, tid, viewMode),
      authReady ? 'auth' : 'anon',
    ],
    queryFn: () =>
      fetchOrganizationDocumentsOverview(id, {
        departmentId: deptId,
        teamId: tid,
        view: viewMode,
      }),
    enabled:
      enabledProp && !authLoading && isAuthenticated && authReady && Boolean(id),
    staleTime: STALE_TIME_ORGS_MS,
    retry: (failureCount, error) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });

  const overview = query.data;
  const isSummary = viewMode === 'summary' || overview?.view === 'summary';
  const files =
    overview && !isSummary ? buildOrgFilesFromOverview(overview, t, locale) : [];

  const documentCount = (() => {
    if (!overview) return null;
    const n = Number(overview.documentCount);
    if (Number.isFinite(n) && n >= 0) return n;
    if (isSummary) return 0;
    return files.length;
  })();

  const orgName =
    String(overview?.orgName || overview?.organization?.name || '').trim();

  return {
    ...query,
    files,
    documentCount,
    orgName,
    overview,
    reload: query.refetch,
  };
}
