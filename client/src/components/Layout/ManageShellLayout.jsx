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
import { toAdminRoutePath } from '../../utils/adminManagePath';

/**
 * Suite Quản trị (`/manage`) — grant-gated, cùng chrome suite (picker) như Communicate/Company/Projects.
 * System admin bị chuyển sang `/admin` (phân hệ riêng).
 */
function ManageShellLayoutInner() {
  const location = useLocation();
  const { headerLoadingLabel } = useShellLayout();
  const { isSystemAdmin, orgId } = useCompanyAdminAccess();
  const { hasGrant, scopeOf, loading, error } = useGrantScopes(orgId);
  const headerLoading = headerLoadingLabel != null;
  const canEnter =
    !isSystemAdmin && hasAnyAdminNavGrant(hasGrant, scopeOf, getVisibleAdminDomains());

  if (isSystemAdmin) {
    const target = toAdminRoutePath(`${location.pathname}${location.search || ''}`);
    return <Navigate to={target} replace />;
  }

  if (orgId && error) {
    return <div className={FIGMA_SHELL_ROOT} />;
  }

  if (orgId && loading) {
    return (
      <div className={FIGMA_SHELL_ROOT} aria-busy="true">
        <div className={FIGMA_SHELL_BODY}>
          <div className="hidden w-56 shrink-0 animate-pulse border-r border-border bg-muted/30 md:block" />
          <div className={FIGMA_SHELL_MAIN}>
            <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
              <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={`manage-skel-${idx}`} className="h-24 animate-pulse rounded-xl bg-muted/60" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canEnter) {
    return <Navigate to={getDefaultPathForSuite(SUITE.COMPANY)} replace />;
  }

  writeStoredSuite(SUITE.MANAGE);

  return (
    <div className={FIGMA_SHELL_ROOT}>
      <TopHeader />
      <ShellRoleBanner />
      <NetworkOfflineBanner />
      <JoinOrganizationModal />
      <FetchBar active={headerLoading} />
      <ShellCommandPalette />
      <div className={FIGMA_SHELL_BODY}>
        <AdminNavigationSidebar surface="manage" />
        <div className={FIGMA_SHELL_MAIN}>
          <PageMotion className="min-h-0 flex-1">
            <Outlet />
          </PageMotion>
        </div>
      </div>
    </div>
  );
}

export default function ManageShellLayout() {
  return (
    <ShellLayoutProvider>
      <ManageShellLayoutInner />
    </ShellLayoutProvider>
  );
}
