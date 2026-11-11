/**
 * Nhãn + path mặc định mục Sidebar admin/manage theo persona grant (không hardcode email).
 * Ưu tiên: Provider → Enterprise IT → Audit → HR → fallback org.
 * Provider (systemAdmin) → `/admin`; persona grant → `/manage`.
 */

import { RBAC_GRANT, adminScopeOpensPage } from './rbacUiGrantMap.js';

export const ADMIN_SUITE_PERSONA = Object.freeze({
  PROVIDER: 'provider',
  ENTERPRISE: 'enterprise',
  AUDIT: 'audit',
  HR: 'hr',
  ORG: 'org',
});

function hubPaths(isSystemAdmin) {
  const root = isSystemAdmin ? '/admin' : '/manage';
  return {
    hub: root,
    users: `${root}/users`,
    audit: `${root}/audit`,
  };
}

function grantOpensAdminPage(hasGrant, scopeOf, key) {
  if (typeof hasGrant !== 'function' || !hasGrant(key)) return false;
  const scope = typeof scopeOf === 'function' ? scopeOf(key) : null;
  return adminScopeOpensPage(scope);
}

/**
 * @param {{ isSystemAdmin?: boolean, hasGrant?: (key: string) => boolean, scopeOf?: (key: string) => string|null }} ctx
 * @returns {{ persona: string, labelKey: string, path: string }}
 */
export function resolveAdminSuiteNavPersona({
  isSystemAdmin = false,
  hasGrant,
  scopeOf,
} = {}) {
  const paths = hubPaths(Boolean(isSystemAdmin));

  if (isSystemAdmin) {
    return {
      persona: ADMIN_SUITE_PERSONA.PROVIDER,
      labelKey: 'nav.adminSuiteProvider',
      path: paths.hub,
    };
  }

  if (grantOpensAdminPage(hasGrant, scopeOf, RBAC_GRANT.ORG_ROLE_UPDATE)) {
    return {
      persona: ADMIN_SUITE_PERSONA.ENTERPRISE,
      labelKey: 'nav.adminSuiteEnterprise',
      path: paths.hub,
    };
  }

  if (grantOpensAdminPage(hasGrant, scopeOf, RBAC_GRANT.AUDIT_VIEW)) {
    return {
      persona: ADMIN_SUITE_PERSONA.AUDIT,
      labelKey: 'nav.adminSuiteAudit',
      path: paths.audit,
    };
  }

  if (
    grantOpensAdminPage(hasGrant, scopeOf, RBAC_GRANT.EMPLOYEE_INVITE) ||
    grantOpensAdminPage(hasGrant, scopeOf, RBAC_GRANT.EMPLOYEE_UPDATE)
  ) {
    return {
      persona: ADMIN_SUITE_PERSONA.HR,
      labelKey: 'nav.adminSuiteHr',
      path: paths.users,
    };
  }

  return {
    persona: ADMIN_SUITE_PERSONA.ORG,
    labelKey: 'nav.adminSuiteOrg',
    path: paths.hub,
  };
}

export default resolveAdminSuiteNavPersona;
