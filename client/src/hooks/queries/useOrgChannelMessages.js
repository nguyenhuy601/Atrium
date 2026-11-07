import { useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_FRIENDS_MS } from '../../lib/queryClient';
import { parseMessageListPage } from '../../lib/parseMessageListPage';
import {
  removeOrgChannelMessageFromInfiniteData,
  upsertOrgChannelMessageInInfiniteData,
} from '../../utils/orgChannelMessageCache';

function orgChannelMessagesQueryKey(roomId, organizationId) {
  return queryKeys.org.channelMessages(String(roomId || ''), String(organizationId || ''));
}

export function upsertOrgChannelMessageCache(queryClient, roomId, organizationId, message) {
  const rid = String(roomId || '').trim();
  if (!queryClient || !rid || !message) return;
  queryClient.setQueryData(orgChannelMessagesQueryKey(rid, organizationId), (prev) =>
    upsertOrgChannelMessageInInfiniteData(prev, message)
  );
}

export function removeOrgChannelMessageCache(queryClient, roomId, organizationId, messageId) {
  const rid = String(roomId || '').trim();
  if (!queryClient || !rid || !messageId) return;
  queryClient.setQueryData(orgChannelMessagesQueryKey(rid, organizationId), (prev) =>
    removeOrgChannelMessageFromInfiniteData(prev, messageId)
  );
}

const ORG_MSG_PAGE_SIZE = 50;

async function fetchOrgChannelMessages({ roomId, organizationId, pageParam }) {
  const params = {
    roomId,
    limit: ORG_MSG_PAGE_SIZE,
    fields: 'summary',
  };
  if (organizationId) params.organizationId = organizationId;
  if (pageParam && typeof pageParam === 'string') {
    params.pageToken = pageParam;
  } else {
    // Chỉ trang đầu: kèm watermark peers để hiện Đã gửi / Đã xem.
    params.includeReadCursors = 1;
  }
  try {
    const resp = await api.get('/messages', {
      params,
      skipPermissionDeniedToast: true,
    });
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'B',location:'useOrgChannelMessages.js:fetchOk',message:'org channel messages OK',data:{roomId:String(roomId||''),organizationId:String(organizationId||''),hasPageParam:Boolean(pageParam)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return parseMessageListPage(resp);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'B',location:'useOrgChannelMessages.js:fetchFail',message:'org channel messages FAIL',data:{roomId:String(roomId||''),organizationId:String(organizationId||''),status:err?.status||err?.response?.status||null,errorCode:err?.errorCode||err?.response?.data?.errorCode||err?.code||null,errMessage:String(err?.message||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

export function useOrgChannelMessages(roomId, organizationId, { enabled = true } = {}) {
  const { isAuthenticated } = useAuth();
  const rid = roomId ? String(roomId) : '';
  const oid = organizationId ? String(organizationId) : '';

  const query = useInfiniteQuery({
    queryKey: queryKeys.org.channelMessages(rid, oid),
    queryFn: ({ pageParam }) =>
      fetchOrgChannelMessages({ roomId: rid, organizationId: oid, pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.nextPageToken && lastPage.hasMore ? lastPage.nextPageToken : undefined,
    staleTime: STALE_TIME_FRIENDS_MS,
    enabled: isAuthenticated && Boolean(rid) && enabled,
  });

  const messagesChronological = useMemo(() => {
    const pages = query.data?.pages || [];
    return pages
      .flatMap((p) => p.messages)
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  }, [query.data]);

  const readCursors = useMemo(() => {
    const pages = query.data?.pages || [];
    for (const page of pages) {
      if (Array.isArray(page?.readCursors)) return page.readCursors;
    }
    return [];
  }, [query.data]);

  const messagesFingerprint = useMemo(() => {
    const pages = query.data?.pages || [];
    return pages
      .map(
        (p, i) =>
          `${i}:${p.messages?.length ?? 0}:${p.nextPageToken ?? ''}:${p.messages?.[0]?._id ?? ''}:${p.messages?.[p.messages?.length - 1]?._id ?? ''}`
      )
      .join('|');
  }, [query.data]);

  return {
    ...query,
    messages: messagesChronological,
    readCursors,
    messagesFingerprint,
    pageSize: ORG_MSG_PAGE_SIZE,
    hasMoreOlder: Boolean(query.hasNextPage),
    loadOlderMessages: () => query.fetchNextPage(),
    loadingOlder: query.isFetchingNextPage,
  };
}

export function useInvalidateOrgChannelMessages() {
  const queryClient = useQueryClient();
  return (roomId, organizationId) => {
    const rid = roomId ? String(roomId) : '';
    const oid = organizationId ? String(organizationId) : '';
    queryClient.invalidateQueries({ queryKey: queryKeys.org.channelMessages(rid, oid) });
  };
}
