import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  MessageCircle,
  PanelLeft,
  Shield,
  User,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkspaceSuite, SUITE } from '../../context/WorkspaceSuiteContext';
import { useAppStrings } from '../../locales/appStrings';
import { FIGMA_TOP_HEADER } from './figmaShellClasses';
import { getDefaultPathForSuite } from '../../utils/suitePathUtils';
import { useShellLayout } from '../../context/ShellLayoutContext';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import MotionPresence from '../../motion/primitives/MotionPresence';
import { VH_MOTION_BTN, VH_MOTION_SPINNER } from '../../motion/classes';
import { motionTransitionFast } from '../../motion/transitions';
import ShellAccountMenu from './ShellAccountMenu';
import {
  ADMIN_SUITE_ACCENT,
  ADMIN_SUITE_ACCENT_GLOW,
  ADMIN_SUITE_ACCENT_HOVER,
} from '../../config/adminSuiteTokens';

function getSuiteMeta(t, adminSuiteNav) {
  const adminLabel = adminSuiteNav?.labelKey
    ? t(adminSuiteNav.labelKey)
    : t('nav.suite.admin.label');
  return {
    [SUITE.COMMUNICATE]: {
      label: t('header.suiteCommunicateLabel'),
      shortLabel: t('header.suiteCommunicateShort'),
      sublabel: t('header.suiteCommunicateSub'),
      Icon: MessageCircle,
      color: '#2563EB',
      gradStart: '#2563EB',
      gradEnd: '#3B82F6',
      bgGlow: 'rgba(37,99,235,0.12)',
    },
    [SUITE.COLLABORATE]: {
      label: t('header.suiteCollaborateLabel'),
      shortLabel: t('header.suiteCollaborateShort'),
      sublabel: t('header.suiteCollaborateSub'),
      Icon: ClipboardList,
      color: '#10B981',
      gradStart: '#059669',
      gradEnd: '#10B981',
      bgGlow: 'rgba(16,185,129,0.12)',
    },
    [SUITE.COMPANY]: {
      label: t('header.suiteCompanyLabel'),
      shortLabel: t('header.suiteCompanyShort'),
      sublabel: t('header.suiteCompanySub'),
      Icon: ClipboardList,
      color: '#10B981',
      gradStart: '#059669',
      gradEnd: '#10B981',
      bgGlow: 'rgba(16,185,129,0.12)',
    },
    [SUITE.PROJECTS]: {
      label: t('header.suiteProjectsLabel'),
      shortLabel: t('header.suiteProjectsShort'),
      sublabel: t('header.suiteProjectsSub'),
      Icon: ClipboardList,
      color: '#8B5CF6',
      gradStart: '#7C3AED',
      gradEnd: '#8B5CF6',
      bgGlow: 'rgba(139,92,246,0.12)',
    },
    [SUITE.ME]: {
      label: t('header.suiteMeLabel'),
      shortLabel: t('header.suiteMeShort'),
      sublabel: t('header.suiteMeSub'),
      Icon: User,
      color: '#F59E0B',
      gradStart: '#D97706',
      gradEnd: '#FBBF24',
      bgGlow: 'rgba(245,158,11,0.12)',
    },
    [SUITE.MANAGE]: {
      label: adminLabel,
      shortLabel: adminLabel,
      sublabel: t('nav.suite.manage.sublabel'),
      Icon: Shield,
      color: ADMIN_SUITE_ACCENT,
      gradStart: ADMIN_SUITE_ACCENT_HOVER,
      gradEnd: ADMIN_SUITE_ACCENT,
      bgGlow: ADMIN_SUITE_ACCENT_GLOW,
    },
    [SUITE.ADMIN]: {
      label: adminLabel,
      shortLabel: adminLabel,
      sublabel: t('nav.suite.admin.sublabel'),
      Icon: Shield,
      color: ADMIN_SUITE_ACCENT,
      gradStart: ADMIN_SUITE_ACCENT_HOVER,
      gradEnd: ADMIN_SUITE_ACCENT,
      bgGlow: ADMIN_SUITE_ACCENT_GLOW,
    },
  };
}

/**
 * Suite TopHeader — Atrium brand + suite label + account.
 * Hidden entirely inside a project by SuiteShellLayout (identity lives in sidebar).
 */
export default function TopHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppStrings();
  const { openMobileNav, mobileNavOpen, headerLoadingLabel, hideHeaderLoading } = useShellLayout();
  const { currentSuite } = useWorkspaceSuite();
  const { adminSuiteNav } = useCompanyAdminAccess();
  const headerLoading = headerLoadingLabel != null;

  useEffect(() => {
    hideHeaderLoading();
  }, [location.pathname, hideHeaderLoading]);

  const SUITE_META = useMemo(() => getSuiteMeta(t, adminSuiteNav), [t, adminSuiteNav]);
  const activeMeta = SUITE_META[currentSuite] || SUITE_META[SUITE.COMMUNICATE];
  const suiteLabel = activeMeta.shortLabel;

  const goSuiteHome = () => {
    navigate(getDefaultPathForSuite(currentSuite) || '/');
  };

  return (
    <header className={FIGMA_TOP_HEADER}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={openMobileNav}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 lg:hidden"
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileNavOpen}
          aria-controls="atrium-mobile-nav"
        >
          <PanelLeft size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={goSuiteHome}
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VH_MOTION_BTN}`}
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)' }}
          aria-label="Atrium"
          title="Atrium"
        >
          <Zap size={15} fill="white" className="text-white" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-[0.9375rem] font-bold leading-tight tracking-tight text-foreground">
            Atrium
          </div>
          <div className="flex items-center gap-0.5">
            <div
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: activeMeta.color }}
            />
            <span
              className="text-[0.5625rem] font-bold uppercase tracking-wider"
              style={{ color: activeMeta.color }}
            >
              {suiteLabel}
            </span>
          </div>
        </div>

        <MotionPresence open={headerLoading}>
          <motion.div
            key="header-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-testid="shell-header-loading"
            className="ml-1 hidden max-w-[12rem] items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground shadow-sm sm:inline-flex"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={motionTransitionFast}
          >
            <span
              aria-hidden
              className={`inline-block h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent ${VH_MOTION_SPINNER}`}
            />
            <span className="truncate">{headerLoadingLabel || t('common.loading')}</span>
          </motion.div>
        </MotionPresence>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <ShellAccountMenu variant="surface" menuPlacement="below" />
      </div>
    </header>
  );
}
