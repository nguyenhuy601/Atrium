import { useEffect, useMemo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import { ShellLayoutProvider, useShellLayout } from '../../context/ShellLayoutContext';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import PageMotion from '../../motion/PageMotion';
import FetchBar from '../../motion/primitives/FetchBar';
import JoinOrganizationModal from './JoinOrganizationModal';
import NetworkOfflineBanner from './NetworkOfflineBanner';
import ShellCommandPalette from './ShellCommandPalette';
import ShellRoleBanner from './ShellRoleBanner';
import TopHeader from './TopHeader';
import { projectIdFromPathname } from './profileDeliveryRoleBadge';
import { FIGMA_SHELL_BODY, FIGMA_SHELL_MAIN, FIGMA_SHELL_ROOT } from './figmaShellClasses';
import { getDefaultPathForSuite, SUITE, writeStoredSuite } from '../../utils/suitePathUtils';
import { useAppStrings } from '../../locales/appStrings';
import { VH_MOTION_BTN } from '../../motion/classes';

function SuiteShellLayoutInner({ sidebar, landingDemo = false }) {
  const location = useLocation();
  const { t } = useAppStrings();
  const {
    immersiveChrome,
    mobileNavOpen,
    openMobileNav,
    headerLoadingLabel,
    hideHeaderLoading,
  } = useShellLayout();
  const { isSystemAdmin } = useCompanyAdminAccess();
  const hideChrome = !landingDemo && immersiveChrome;
  const hideTopHeader = useMemo(
    () => Boolean(projectIdFromPathname(location.pathname)),
    [location.pathname]
  );
  const headerLoading = headerLoadingLabel != null;
  const showTopHeader = !landingDemo && !hideChrome && !hideTopHeader;
  const showShellTools = !landingDemo && !hideChrome;

  useEffect(() => {
    if (!hideTopHeader) return undefined;
    hideHeaderLoading();
    return undefined;
  }, [location.pathname, hideTopHeader, hideHeaderLoading]);

  // Tài khoản hệ thống admin không dùng shell nhân viên (communicate/collaborate/me).
  if (!landingDemo && isSystemAdmin) {
    writeStoredSuite(SUITE.ADMIN);
    return <Navigate to={getDefaultPathForSuite(SUITE.ADMIN)} replace />;
  }

  return (
    <div className={FIGMA_SHELL_ROOT}>
      {showTopHeader ? <TopHeader /> : null}
      {!landingDemo && !hideChrome && <ShellRoleBanner />}
      {!landingDemo && <NetworkOfflineBanner />}
      {!landingDemo && <JoinOrganizationModal />}
      {showShellTools ? (
        <>
          <FetchBar active={headerLoading} />
          <ShellCommandPalette />
        </>
      ) : null}
      {hideTopHeader && !hideChrome && !mobileNavOpen ? (
        <button
          type="button"
          onClick={openMobileNav}
          className={`fixed left-3 top-3 z-[210] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground shadow-md lg:hidden ${VH_MOTION_BTN}`}
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileNavOpen}
          aria-controls="atrium-mobile-nav"
        >
          <PanelLeft size={18} strokeWidth={2} />
        </button>
      ) : null}
      <div className={FIGMA_SHELL_BODY}>
        {!hideChrome ? sidebar : null}
        <div className={FIGMA_SHELL_MAIN}>
          <PageMotion className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </PageMotion>
        </div>
      </div>
    </div>
  );
}

const SuiteShellLayout = ({ sidebar, landingDemo = false }) => (
  <ShellLayoutProvider>
    <SuiteShellLayoutInner sidebar={sidebar} landingDemo={landingDemo} />
  </ShellLayoutProvider>
);

export default SuiteShellLayout;
