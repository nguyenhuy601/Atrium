import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AdminNavigationSidebar from './AdminNavigationSidebar';
import JoinOrganizationModal from './JoinOrganizationModal';
import NetworkOfflineBanner from './NetworkOfflineBanner';
import ShellCommandPalette from './ShellCommandPalette';
import ShellRoleBanner from './ShellRoleBanner';
import TopHeader from './TopHeader';
import { ShellLayoutProvider, useShellLayout } from '../../context/ShellLayoutContext';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import { useGrantScopes } from '../../hooks/useGrantScopes';
import { getVisibleAdminDomains } from '../../config/adminDomainsConfig';
import { hasAnyAdminNavGrant } from '../../config/rbacUiGrantMap';
import PageMotion from '../../motion/PageMotion';
import FetchBar from '../../motion/primitives/FetchBar';
import { FIGMA_SHELL_BODY, FIGMA_SHELL_MAIN, FIGMA_SHELL_ROOT } from './figmaShellClasses';
import { getDefaultPathForSuite, SUITE, writeStoredSuite } from '../../utils/suitePathUtils';
import { toManageRoutePath } from '../../utils/adminManagePath';
import { adminSuiteAccentVars } from '../../config/adminSuiteTokens';

/**
 * Phân hệ Admin hạ tầng (`/admin`) — chỉ systemRole=admin.
 * User được cấp grant cấu hình → chuyển sang suite `/manage`.
 */
function AdminShellLayoutInner() {
  const location = useLocation();
  const { headerLoadingLabel } = useShellLayout();
  const { isSystemAdmin, orgId } = useCompanyAdminAccess();
  const { hasGrant, scopeOf, loading, error } = useGrantScopes(orgId);
  const headerLoading = headerLoadingLabel != null;
  const hasManageGrant = hasAnyAdminNavGrant(hasGrant, scopeOf, getVisibleAdminDomains());

  if (!isSystemAdmin && orgId && error) {
    return <div className={FIGMA_SHELL_ROOT} />;
  }

  if (!isSystemAdmin && orgId && loading) {
    return (
      <div className={FIGMA_SHELL_ROOT} aria-busy="true">
        <div className={FIGMA_SHELL_BODY}>
          <div className="hidden w-56 shrink-0 animate-pulse border-r border-border bg-muted/30 md:block" />
          <div className={FIGMA_SHELL_MAIN}>
            <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
              <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isSystemAdmin) {
    if (hasManageGrant) {
      const target = toManageRoutePath(`${location.pathname}${location.search || ''}`);
      return <Navigate to={target} replace />;
    }
    return <Navigate to={getDefaultPathForSuite(SUITE.COMPANY)} replace />;
  }

  writeStoredSuite(SUITE.ADMIN);

  return (
    <div className={FIGMA_SHELL_ROOT} style={adminSuiteAccentVars()}>
      <TopHeader />
      <ShellRoleBanner />
      <NetworkOfflineBanner />
      <JoinOrganizationModal />
      <FetchBar active={headerLoading} />
      <ShellCommandPalette />
      <div className={FIGMA_SHELL_BODY}>
        <AdminNavigationSidebar surface="admin" />
        <div className={FIGMA_SHELL_MAIN}>
          <PageMotion className="min-h-0 flex-1">
            <Outlet />
          </PageMotion>
        </div>
      </div>
    </div>
  );
}

export default function AdminShellLayout() {
  return (
    <ShellLayoutProvider>
      <AdminShellLayoutInner />
    </ShellLayoutProvider>
  );
}
