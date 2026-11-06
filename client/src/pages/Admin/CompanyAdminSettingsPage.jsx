import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import OrganizationSettingsPanel from '../../components/Organization/OrganizationSettingsPanel';
import { ADMIN_DOMAINS, adminSettingsEmbedTabFromItem, findAdminNavItem } from '../../config/adminDomainsConfig';
import { collectAdminRouteEntries, decideAdminRoute } from '../../config/adminRouteAccess';
import { navItemIsAllowed } from '../../config/rbacUiGrantMap';
import { useGrantScopes } from '../../hooks/useGrantScopes';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import { useCompanyAdminContext } from './CompanyAdminLayout';

export default function CompanyAdminSettingsPage() {
  const location = useLocation();
  const match = findAdminNavItem(location.pathname);
  const settingsTab = adminSettingsEmbedTabFromItem(match?.item);
  const { organization, organizationLoading, orgId, refreshOrganization } = useCompanyAdminContext();
  const { isSystemAdmin } = useCompanyAdminAccess();
  const { hasGrant, scopeOf, loading } = useGrantScopes(orgId);
  const entries = useMemo(() => collectAdminRouteEntries(ADMIN_DOMAINS), []);

  if (loading || organizationLoading) return null;

  if (match?.item && !navItemIsAllowed(match.item, { hasGrant, scopeOf, isSystemAdmin })) {
    const decision = decideAdminRoute({
      pathname: location.pathname,
      entries,
      hasGrant,
      scopeOf,
      isSystemAdmin,
    });
    if (decision.action === 'redirect-first-allowed' && decision.path) {
      return <Navigate to={decision.path} replace />;
    }
    return <Navigate to="/company/home" replace state={{ routeDenied: 'admin' }} />;
  }

  if (!settingsTab || !organization) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <OrganizationSettingsPanel
      organization={organization}
      initialTab={settingsTab}
      lockTab={settingsTab}
      hideChrome
      hideBranchUi
      suiteLayout={false}
      onOrganizationUpdated={refreshOrganization}
    />
  );
}
