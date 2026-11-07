import api from '../../services/api';
import friendService from '../../services/friendService';
import { organizationAPI } from '../../services/api/organizationAPI';

export function unwrapOrganizationsMy(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export async function fetchOrganizationsMy() {
  const payload = await organizationAPI.getOrganizations();
  return unwrapOrganizationsMy(payload);
}

export function unwrapFriendsList(resp) {
  const payload = resp?.data ?? resp;
  const result = payload?.data ?? payload;
  const list = result?.friends ?? result;
  return Array.isArray(list) ? list : [];
}

export async function fetchFriendsList(status = 'accepted') {
  const params = status && status !== 'accepted' ? { status } : {};
  try {
    const resp = await friendService.getFriends(params);
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'A',location:'fetchers.js:fetchFriendsListOk',message:'friends list OK',data:{statusParam:String(status||'accepted'),count:unwrapFriendsList(resp).length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return unwrapFriendsList(resp);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'A',location:'fetchers.js:fetchFriendsListFail',message:'friends list FAIL',data:{statusParam:String(status||'accepted'),status:err?.status||err?.response?.status||null,errorCode:err?.errorCode||err?.response?.data?.errorCode||err?.code||null,errMessage:String(err?.message||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

export async function fetchNotificationBadge({ scope = 'personal', organizationId = '' } = {}) {
  const params = { limit: 1, scope };
  if (scope === 'organization' && organizationId) {
    params.organizationId = String(organizationId);
  }
  const resp = await api.get('/notifications', {
    params,
    skipGlobalErrorHandling: true,
  });
  const d = resp?.data?.data ?? resp?.data ?? resp;
  return {
    unreadCount: Number(d?.unreadCount) || 0,
  };
}

export async function fetchNotificationsPreview({
  scope = 'personal',
  organizationId = '',
  limit = 8,
} = {}) {
  const params = { limit, scope };
  if (scope === 'organization' && organizationId) {
    params.organizationId = String(organizationId);
  }
  const resp = await api.get('/notifications', {
    params,
    skipGlobalErrorHandling: true,
  });
  const nd = resp?.data?.data ?? resp?.data ?? resp;
  return {
    unreadCount: Number(nd?.unreadCount) || 0,
    notifications: Array.isArray(nd?.notifications) ? nd.notifications : [],
  };
}
