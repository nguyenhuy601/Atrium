/**
 * Suite Quản trị (`/manage`) vs Admin hạ tầng (`/admin`).
 * Config/nav SoT vẫn dùng prefix `/admin`; surface Manage rewrite khi render / deep-link.
 */

import { stripLegacyAppPrefix } from './suitePathUtils.js';

export const ADMIN_ROUTE_PREFIX = '/admin';
export const MANAGE_ROUTE_PREFIX = '/manage';

function pathOnly(pathname = '') {
  return stripLegacyAppPrefix(String(pathname || '').split('?')[0]).replace(/\/+$/, '') || '/';
}

export function isManageRoutePath(pathname = '') {
  const p = pathOnly(pathname);
  return p === MANAGE_ROUTE_PREFIX || p.startsWith(`${MANAGE_ROUTE_PREFIX}/`);
}

export function isAdminRoutePath(pathname = '') {
  const p = pathOnly(pathname);
  return p === ADMIN_ROUTE_PREFIX || p.startsWith(`${ADMIN_ROUTE_PREFIX}/`);
}

/** `/manage/...` → `/admin/...` để match adminDomainsConfig / findAdminNavItem. */
export function toAdminConfigPath(pathname = '') {
  const p = pathOnly(pathname);
  if (p === MANAGE_ROUTE_PREFIX) return ADMIN_ROUTE_PREFIX;
  if (p.startsWith(`${MANAGE_ROUTE_PREFIX}/`)) {
    return `${ADMIN_ROUTE_PREFIX}${p.slice(MANAGE_ROUTE_PREFIX.length)}`;
  }
  return p === '/' ? ADMIN_ROUTE_PREFIX : p;
}

/** `/admin/...` → `/manage/...` (giữ query nếu có). */
export function toManageRoutePath(adminOrManagePath = '') {
  const raw = String(adminOrManagePath || '');
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const search = qIndex === -1 ? '' : raw.slice(qIndex);
  const p = pathOnly(pathPart);
  if (p === MANAGE_ROUTE_PREFIX || p.startsWith(`${MANAGE_ROUTE_PREFIX}/`)) {
    return `${p}${search}`;
  }
  if (p === ADMIN_ROUTE_PREFIX) return `${MANAGE_ROUTE_PREFIX}${search}`;
  if (p.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) {
    return `${MANAGE_ROUTE_PREFIX}${p.slice(ADMIN_ROUTE_PREFIX.length)}${search}`;
  }
  return `${MANAGE_ROUTE_PREFIX}${search}`;
}

/** `/manage/...` → `/admin/...` (giữ query). */
export function toAdminRoutePath(adminOrManagePath = '') {
  const raw = String(adminOrManagePath || '');
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const search = qIndex === -1 ? '' : raw.slice(qIndex);
  const p = pathOnly(pathPart);
  if (p === ADMIN_ROUTE_PREFIX || p.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) {
    return `${p}${search}`;
  }
  if (p === MANAGE_ROUTE_PREFIX) return `${ADMIN_ROUTE_PREFIX}${search}`;
  if (p.startsWith(`${MANAGE_ROUTE_PREFIX}/`)) {
    return `${ADMIN_ROUTE_PREFIX}${p.slice(MANAGE_ROUTE_PREFIX.length)}${search}`;
  }
  return `${ADMIN_ROUTE_PREFIX}${search}`;
}

/**
 * @param {string} adminConfigPath path SoT `/admin/...`
 * @param {'admin'|'manage'} surface
 */
export function surfaceAdminPath(adminConfigPath, surface = 'admin') {
  const raw = String(adminConfigPath || ADMIN_ROUTE_PREFIX);
  if (surface === 'manage') return toManageRoutePath(raw);
  return toAdminRoutePath(raw.startsWith('/manage') ? toAdminConfigPath(raw) : raw);
}
