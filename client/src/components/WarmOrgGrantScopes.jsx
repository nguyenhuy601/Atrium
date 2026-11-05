import useCompanyAdminAccess from '../hooks/useCompanyAdminAccess';

/**
 * Prefetch grantScopes (React Query) ngay khi đã có orgId — trước khi vào Admin Hub
 * hoặc khi CTA Projects cần project.project.create.
 * useCompanyAdminAccess → useGrantScopes; render null.
 */
export default function WarmOrgGrantScopes() {
  useCompanyAdminAccess();
  return null;
}
