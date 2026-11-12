import axios from 'axios';
import {
  applyAuthHeader,
  getJwtPayload,
  getToken,
  setToken,
} from './tokenStorage';
import { resolveApiBaseUrl } from './browserOrigin';
import { clearSessionMarkerCookie } from './sessionMarkerCookie';

let refreshPromise = null;

/** Skew: coi access JWT gần hết hạn cũng cần refresh. */
const ACCESS_EXPIRY_SKEW_MS = 30_000;

/** 429 trên refresh — giữ session, không coi như logout. */
export function isAuthRefreshRateLimited(error) {
  return Boolean(error?.isAuthRateLimited) || Number(error?.response?.status) === 429;
}

/** Access thiếu hoặc đã (sắp) hết hạn — mới được gọi refresh vì 401. */
export function isAccessTokenMissingOrExpired(nowMs = Date.now()) {
  if (!getToken()) return true;
  const payload = getJwtPayload();
  if (!payload || payload.exp == null) return true;
  const expMs = Number(payload.exp) * 1000;
  if (!Number.isFinite(expMs)) return true;
  return expMs <= nowMs + ACCESS_EXPIRY_SKEW_MS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRetryAfterMs(error) {
  const raw = error?.response?.headers?.['retry-after'];
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000, 10_000);
  return 2000;
}

function refreshErrorCode(error) {
  return String(
    error?.response?.data?.errorCode || error?.response?.data?.code || error?.errorCode || ''
  ).trim();
}

/** Chỉ xóa marker khi server xác nhận phiên chết — không xóa khi mismatch race. */
function clearMarkerIfSessionDead(error) {
  if (refreshErrorCode(error) === 'AUTH_REFRESH_MISMATCH') return;
  clearSessionMarkerCookie();
}

async function postRefreshOnce() {
  const API_URL = resolveApiBaseUrl();
  const res = await axios.post(
    `${API_URL}/auth/refresh-token`,
    {},
    {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        // Header required by CSRF guard in refresh/logout flows.
        'X-Atrium-Client': '1',
      },
      timeout: 30000,
    }
  );

  const envelope = res.data;
  const body = envelope?.data !== undefined ? envelope.data : envelope;
  const accessToken = body?.accessToken || body?.token;
  if (!accessToken) {
    throw new Error('INVALID_REFRESH_RESPONSE');
  }

  setToken(accessToken);
  return accessToken;
}

async function callRefreshEndpoint() {
  try {
    return await postRefreshOnce();
  } catch (error) {
    const status = Number(error?.response?.status);
    if (status === 401) {
      clearMarkerIfSessionDead(error);
      throw error;
    }
    if (status === 429) {
      await sleep(resolveRetryAfterMs(error));
      try {
        return await postRefreshOnce();
      } catch (retryErr) {
        if (Number(retryErr?.response?.status) === 401) {
          clearMarkerIfSessionDead(retryErr);
        }
        if (Number(retryErr?.response?.status) === 429) {
          retryErr.isAuthRateLimited = true;
        }
        throw retryErr;
      }
    }
    throw error;
  }
}

/** Single-flight refresh — tránh storm khi nhiều request 401 cùng lúc. */
export function refreshAccessTokenSingleFlight() {
  if (!refreshPromise) {
    refreshPromise = callRefreshEndpoint().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Thử refresh + retry request gốc (tối đa 1 lần).
 * Chỉ khi access JWT thiếu/hết hạn — tránh rotate thừa vì 401 quyền/nghiệp vụ.
 * @returns {Promise<unknown>|null} response nếu retry thành công; null nếu không áp dụng
 */
export async function tryRefreshAndRetry(error, axiosInstance) {
  const config = error?.config;
  if (!config || config.__authRefreshRetried || config.skipAuthRefresh) {
    return null;
  }

  const url = String(config.url || '');
  if (url.includes('/auth/refresh-token') || url.includes('/auth/login')) {
    return null;
  }

  if (!isAccessTokenMissingOrExpired()) {
    return null;
  }

  await refreshAccessTokenSingleFlight();
  config.__authRefreshRetried = true;
  applyAuthHeader(config);
  return axiosInstance.request(config);
}
