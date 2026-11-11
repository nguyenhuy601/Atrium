import { cloneElement, isValidElement, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  MessageCircle,
  Mic,
  Shield,
} from 'lucide-react';
import SidebarPositionFooter from './SidebarPositionFooter';
import { Link, useLocation } from 'react-router-dom';
import useUiRole from '../../hooks/useUiRole';
import { getRoleMeta } from '../../config/roleMeta';
import { useWorkspace } from '../../context/WorkspaceContext';
import { readSingleOrgModeFlag } from '../../utils/singleCompanyMode';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import {
  extractOrganizationRoleKeys,
  resolveNavRoleFromOrgKeys,
} from '../../utils/organizationRoleKeys';
import { useShellLayout } from '../../context/ShellLayoutContext';
import { useWorkspaceSuite, SUITE } from '../../context/WorkspaceSuiteContext';
import { useAppStrings } from '../../locales/appStrings';
import { useNotificationBadge } from '../../hooks/queries';
import { useSpace } from '../../context/SpaceContext';
import {
  buildCompanyApprovalsPath,
  buildCompanyCalendarPath,
  buildCompanyChatPath,
  buildCompanyDocumentsPath,
  buildCompanyHomePath,
  buildCompanyOverviewPath,
  buildCompanyWorkspacePath,
  isCompanyChatModulePath,
  isCompanyDocumentsModulePath,
  isImmersiveCompanyModulePath,
  buildCollaborateCalendarPath,
  buildCollaborateDocumentsPath,
  buildCollaborateTasksPath,
  getDefaultPathForSuite,
} from '../../utils/suitePathUtils';
import { COMPANY_SPACE_LEVEL } from '../../utils/companySpaceLevel';
import { motion } from 'motion/react';
import { VH_NAV_CHEVRON } from '../../motion/classes';
import MotionPresence from '../../motion/primitives/MotionPresence';
import { motionPopover } from '../../motion/overlayMotion';

import {
  FIGMA_SIDEBAR,
  FIGMA_SIDEBAR_COLLAPSED,
  FIGMA_SIDEBAR_EXPANDED,
  FIGMA_SIDEBAR_NAV,
  FIGMA_SIDEBAR_SECTION_LABEL,
  FIGMA_SIDEBAR_SUITE_STRIP,
  SUITE_COLORS,
  figmaNavItemBg,
  figmaNavItemClass,
  FIGMA_SIDEBAR_EXPAND_BTN,
  FIGMA_SIDEBAR_FOOTER,
} from './figmaShellClasses';

const COLLAPSE_KEY = 'vh_sidebar_collapsed';
/** Prefs riêng khi đứng Drive — không lẫn collapse chat / menu thường. */
const DRIVE_NAV_COLLAPSE_KEY = 'vh.companyNav.driveCollapsed.v1';

function readCollapsePref(key, fallback = false) {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved != null && saved !== '') return Boolean(JSON.parse(saved));
  } catch {
    /* ignore */
  }
  return fallback;
}

const NAV_ROLE_KEYS = {
  admin: 'nav.roleAdmin',
  orgAdmin: 'nav.roleOrgAdmin',
  owner: 'nav.roleOwner',
  manager: 'nav.roleManager',
  hr: 'nav.roleMember',
  deptHead: 'nav.roleDeptHead',
  teamLeader: 'nav.roleTeamLeader',
  member: 'nav.roleMember',
  guest: 'nav.roleGuest',
  personal: 'nav.rolePersonal',
};

const ROLE_COLORS = {
  admin: '#EF4444',
  orgAdmin: '#EF4444',
  owner: '#F59E0B',
  manager: '#3B82F6',
  hr: '#8B5CF6',
  deptHead: '#3B82F6',
  teamLeader: '#06B6D4',
  member: '#10B981',
  guest: '#9CA3AF',
  personal: '#2563EB',
};

/**
 * Sidebar footer: Org Role (membership) + Position/cấu trúc + catalog Org Role.
 * Gói Permission chưa map API → không dùng để chọn nav.
 * JWT systemRole chỉ khi isSystemAdmin (tài khoản nền tảng) — không map employee → «Thành viên».
 */
function resolveSidebarDisplayRole({
  uiRole,
  myOrgRole,
  myStructureRole,
  isSystemAdmin,
  organizationRoleKeys,
}) {
  const org = String(myOrgRole || '').toLowerCase();
  if (org === 'owner') return 'owner';
  if (org === 'admin') return 'orgAdmin';
  if (org === 'hr') return 'hr';
  if (org === 'manager') return 'manager';
  if (isSystemAdmin) return 'admin';
  const structure = String(myStructureRole || '').toLowerCase();
  if (structure === 'head') return 'deptHead';
  if (structure === 'leader') return 'teamLeader';
  const fromOrgKeys = resolveNavRoleFromOrgKeys(organizationRoleKeys);
  if (fromOrgKeys) return fromOrgKeys;
  if (org === 'member') return 'member';
  return String(uiRole || 'member').toLowerCase();
}

function filterNavForRole(items, roleKey, suiteProp) {
  if (roleKey === 'guest') {
    const allowed = new Set(['notifications', 'friends', 'profile', 'settings']);
    return items.filter((item) => allowed.has(item.key));
  }
  if (roleKey === 'personal') {
    if (suiteProp === 'collaborate' || suiteProp === 'company') {
      return items.filter((item) => !['workspaces', 'tasks', 'documents'].includes(item.key));
    }
    if (suiteProp === 'communicate') {
      return items.filter((item) => item.key !== 'channels');
    }
  }
  return items;
}

function NavItem({ item, collapsed, suiteColor, isActive }) {
  const Icon = item.icon;
  const content = (
    <>
      {isActive && (
        <span
          className="absolute bottom-[18%] left-0 top-[18%] w-[3px] rounded-r-sm"
          style={{ background: suiteColor, boxShadow: `0 0 8px ${suiteColor}88` }}
        />
      )}
      <Icon size={15} className="shrink-0" style={{ color: isActive ? suiteColor : undefined }} />
      {!collapsed && (
        <span
          className="min-w-0 flex-1 text-left whitespace-nowrap text-[0.8125rem] tracking-tight"
          style={{ fontWeight: isActive ? 500 : 400, color: isActive ? '#E2E8F0' : undefined }}
        >
          {item.label}
        </span>
      )}
      {item.tag && !collapsed && (
        <span
          className="rounded px-1 py-px text-[0.5rem] font-bold tracking-wider"
          style={{ background: `${suiteColor}30`, color: suiteColor }}
        >
          {item.tag}
        </span>
      )}
      {item.badge > 0 && !collapsed && (
        <span
          className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[0.625rem] font-bold text-white"
          style={{ background: isActive ? `${suiteColor}44` : suiteColor }}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      {item.badge > 0 && collapsed && (
        <span
          className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.5rem] font-bold text-white"
          style={{ background: suiteColor }}
        >
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
    </>
  );

  const className = figmaNavItemClass(isActive, suiteColor, collapsed);
  const style = figmaNavItemBg(isActive, suiteColor);

  if (item.externalNavigate) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className="group relative block w-full border-none bg-transparent p-0 text-left"
        title={collapsed ? item.label : undefined}
      >
        <div className={className} style={style}>
          {content}
        </div>
        {collapsed && (
          <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-surface px-2.5 py-1 text-xs font-medium text-slate-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {item.label}
          </div>
        )}
      </button>
    );
  }

  return (
    <Link to={item.path} className="group relative block" title={collapsed ? item.label : undefined}>
      <div className={className} style={style}>
        {content}
      </div>
      {collapsed && (
        <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-surface px-2.5 py-1 text-xs font-medium text-slate-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {item.label}
        </div>
      )}
    </Link>
  );
}

function segmentFromProp(suiteProp) {
  if (suiteProp === 'communicate') return 'communicate';
  if (suiteProp === 'collaborate' || suiteProp === 'company') return 'company';
  if (suiteProp === 'projects') return 'projects';
  if (suiteProp === 'me') return 'me';
  return 'communicate';
}

export default function FigmaNavigationSidebar({
  suite: suiteProp = 'communicate',
  landingDemo = false,
  contextSwitch = null,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (isCompanyDocumentsModulePath(window.location.pathname)) {
      return readCollapsePref(DRIVE_NAV_COLLAPSE_KEY, true);
    }
    return readCollapsePref(COLLAPSE_KEY, isImmersiveCompanyModulePath(window.location.pathname));
  });
  const [showSuitePicker, setShowSuitePicker] = useState(false);
  const location = useLocation();
  const { t } = useAppStrings();
  const { navigateToSuite } = useWorkspaceSuite();
  const { activeWorkspace, singleOrgMode, company } = useWorkspace();
  const { mobileNavOpen, closeMobileNav } = useShellLayout();
  const space = useSpace();
  const activeOrgId = String(
    activeWorkspace?._id ||
      activeWorkspace?.id ||
      activeWorkspace?.organizationId ||
      company?.id ||
      company?._id ||
      space?.organizationId ||
      ''
  ).trim();
  const spaceDeptId = String(space?.departmentId || '').trim();
  const spaceTeamId = String(space?.teamId || '').trim();
  const spaceLevel = space?.level || COMPANY_SPACE_LEVEL.DEPARTMENT;
  const isTeamLevel =
    spaceLevel === COMPANY_SPACE_LEVEL.TEAM && Boolean(spaceTeamId);

  const suiteSegment = segmentFromProp(suiteProp);
  const suiteColor = SUITE_COLORS[suiteSegment] || SUITE_COLORS.communicate;

  const { unreadCount } = useNotificationBadge({
    scope: suiteProp === 'collaborate' || suiteProp === 'company' ? 'organization' : 'personal',
    organizationId: activeOrgId,
    enabled: !landingDemo,
  });
  useEffect(() => {
    closeMobileNav();
  }, [location.pathname, closeMobileNav]);

  useEffect(() => {
    if (isCompanyDocumentsModulePath(location.pathname)) {
      setCollapsed(readCollapsePref(DRIVE_NAV_COLLAPSE_KEY, true));
      return;
    }
    setCollapsed(
      readCollapsePref(COLLAPSE_KEY, isCompanyChatModulePath(location.pathname))
    );
  }, [location.pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    const key = isCompanyDocumentsModulePath(location.pathname)
      ? DRIVE_NAV_COLLAPSE_KEY
      : COLLAPSE_KEY;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (next) setShowSuitePicker(false);
  };

  const { role, meta } = useUiRole();
  const isSingleCompany = singleOrgMode || readSingleOrgModeFlag();
  const { isSystemAdmin, myOrgRole, canAccessHub, adminSuiteNav } = useCompanyAdminAccess();
  // Suite Quản trị (/manage): grant opener — không phải system admin (system admin chỉ /admin).
  const showManageSuite = Boolean(canAccessHub) && !isSystemAdmin;
  const adminNavLabel = t(adminSuiteNav.labelKey);
  const adminNavPath = adminSuiteNav.path || '/manage';
  const suiteLabels = {
    label:
      suiteSegment === 'manage' || suiteSegment === 'admin'
        ? adminNavLabel
        : t(`nav.suite.${suiteSegment}.label`),
    sublabel: t(`nav.suite.${suiteSegment}.sublabel`),
  };
  // Approvers include IC project roles (TL/QA) — inbox ACL is server-side (canAct / requester)
  const showApprovalInbox = suiteProp === 'collaborate' || suiteProp === 'company';
  const myStructureRole = String(
    company?.myStructureRole || activeWorkspace?.myStructureRole || ''
  ).toLowerCase();
  const organizationRoleKeys = extractOrganizationRoleKeys(company, activeWorkspace);
  const displayRoleKey = resolveSidebarDisplayRole({
    uiRole: role,
    myOrgRole,
    myStructureRole,
    isSystemAdmin,
    organizationRoleKeys,
  });
  const metaRoleKey =
    displayRoleKey === 'hr' || displayRoleKey === 'orgAdmin'
      ? 'admin'
      : displayRoleKey === 'deptHead' || displayRoleKey === 'teamLeader'
        ? 'manager'
        : displayRoleKey;
  const displayMeta = getRoleMeta(metaRoleKey);
  const roleColor = displayMeta.color || ROLE_COLORS[displayRoleKey] || '#2563EB';
  const roleLabel = t(NAV_ROLE_KEYS[displayRoleKey] || 'nav.roleMember');

  const navItems = useMemo(() => {
    if (suiteProp === 'communicate') {
      const items = [
        {
          key: 'overview',
          icon: LayoutDashboard,
          label: t('nav.overview'),
          path: '/communicate/overview',
          badge: 0,
        },
        {
          key: 'notifications',
          icon: Bell,
          label: t('nav.notifications'),
          path: '/communicate/notifications',
          badge: landingDemo ? 0 : unreadCount,
        },
        {
          key: 'friends',
          icon: MessageCircle,
          label: t('nav.messages'),
          path: '/communicate/chat/friends',
          badge: 0,
        },
        {
          key: 'voice',
          icon: Mic,
          label: t('nav.voiceMeet'),
          path: '/communicate/voice',
          badge: 0,
        },
      ];
      if (showManageSuite) {
        items.push({
          key: 'company-admin',
          icon: Shield,
          label: adminNavLabel,
          externalNavigate: true,
          onClick: () => navigateToSuite(SUITE.MANAGE, { path: adminNavPath }),
          path: adminNavPath,
          badge: 0,
        });
      }
      return items;
    }
    if (suiteProp === 'collaborate' || suiteProp === 'company') {
      const isCompany = suiteProp === 'company' || suiteProp === 'collaborate';
      if (isCompany && suiteProp === 'company') {
        const scopeQuery = {
          departmentId: spaceDeptId,
          teamId: isTeamLevel ? spaceTeamId : '',
        };
        const items = [
          {
            key: 'home',
            icon: Home,
            label: t('nav.companyHome'),
            path: buildCompanyHomePath({
              organizationId: activeOrgId,
              departmentId: spaceDeptId,
              teamId: isTeamLevel ? spaceTeamId : '',
            }),
            badge: 0,
          },
          {
            key: 'chat',
            icon: MessageCircle,
            label: t('nav.messages'),
            // Dept: announcement channel data; SpaceChatModule hides hub chrome → straight chat UI.
            path: buildCompanyChatPath(activeOrgId, {
              ...scopeQuery,
              tab: isTeamLevel ? 'chat' : 'announcement',
            }),
            badge: 0,
          },
          {
            key: 'documents',
            icon: FileText,
            label: t('nav.documents'),
            path: buildCompanyDocumentsPath(activeOrgId, scopeQuery),
            badge: 0,
          },
        ];
        if (showManageSuite) {
          items.push({
            key: 'company-admin',
            icon: Shield,
            label: adminNavLabel,
            externalNavigate: true,
            onClick: () => navigateToSuite(SUITE.MANAGE, { path: adminNavPath }),
            path: adminNavPath,
            badge: 0,
          });
        }
        return items;
      }
      const items = [
        {
          key: 'overview',
          icon: LayoutDashboard,
          label: t('nav.overview'),
          path: isCompany ? buildCompanyOverviewPath(activeOrgId) : '/collaborate/overview',
          badge: 0,
        },
        {
          key: 'workspaces',
          icon: Building2,
          label: isSingleCompany ? t('nav.companyWorkspaces') : t('nav.workspaces'),
          path: isCompany
            ? buildCompanyWorkspacePath({ organizationId: activeOrgId })
            : '/collaborate/workspaces',
          badge: 0,
        },
        {
          key: 'chat',
          icon: MessageCircle,
          label: t('nav.messages'),
          path: buildCompanyChatPath(activeOrgId),
          badge: 0,
        },
        {
          key: 'documents',
          icon: FileText,
          label: t('nav.documents'),
          path: buildCompanyDocumentsPath(activeOrgId),
          badge: 0,
        },
        {
          key: 'calendar',
          icon: Calendar,
          label: t('nav.calendar'),
          path: buildCompanyCalendarPath(activeOrgId),
          badge: 0,
        },
      ];
      if (showApprovalInbox) {
        items.push({
          key: 'approvals',
          icon: ClipboardList,
          label: t('nav.approvals'),
          path: buildCompanyApprovalsPath(activeOrgId),
          badge: 0,
        });
      }
      // Legacy collaborate also exposed projects — company suite does not.
      if (suiteProp === 'collaborate') {
        items.splice(2, 0, {
          key: 'tasks',
          icon: ClipboardList,
          label: isSingleCompany ? t('nav.projects') : t('nav.kanbanTasks'),
          path: buildCollaborateTasksPath(activeOrgId),
          tag: t('common.newBadge'),
          badge: 0,
        });
      }
      if (showManageSuite) {
        items.push({
          key: 'company-admin',
          icon: Shield,
          label: adminNavLabel,
          externalNavigate: true,
          onClick: () => navigateToSuite(SUITE.MANAGE, { path: adminNavPath }),
          path: adminNavPath,
          badge: 0,
        });
      }
      return items;
    }
    return [];
  }, [
    suiteProp,
    t,
    landingDemo,
    unreadCount,
    activeOrgId,
    spaceDeptId,
    spaceTeamId,
    isTeamLevel,
    isSingleCompany,
    showApprovalInbox,
    showManageSuite,
    adminNavLabel,
    adminNavPath,
    navigateToSuite,
  ]);

  const visibleNavItems = useMemo(
    () => filterNavForRole(navItems, role, suiteProp),
    [navItems, role, suiteProp]
  );

  const isActivePath = (path) => {
    if (!path) return false;
    const base = path.split('?')[0];
    if (base === '/communicate/overview') return location.pathname === '/communicate/overview';
    if (base === '/collaborate/overview' || base === '/company/overview') {
      return (
        location.pathname === '/collaborate/overview' ||
        location.pathname === '/company/overview'
      );
    }
    if (base === '/admin') return location.pathname === '/admin' || location.pathname.startsWith('/admin/');
    if (base === '/manage') return location.pathname === '/manage' || location.pathname.startsWith('/manage/');
    if (base === '/collaborate/approvals' || base === '/company/approvals') {
      return (
        location.pathname === '/collaborate/approvals' ||
        location.pathname === '/company/approvals'
      );
    }
    if (base === '/me/dashboard') return location.pathname === '/me/dashboard';
    if (base === '/me/settings') return location.pathname === '/me/settings';
    if (base === '/collaborate/workspaces' || base === '/company/workspaces') {
      return (
        location.pathname === '/collaborate/workspaces' ||
        location.pathname === '/company/workspaces'
      );
    }
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  };

  const isActiveNavItem = (item) => {
    const path = location.pathname;
    if (suiteProp === 'collaborate' || suiteProp === 'company') {
      if (item.key === 'home') {
        return path === '/company/home' || path.startsWith('/company/home/');
      }
      if (item.key === 'overview') {
        return path === '/collaborate/overview' || path === '/company/overview';
      }
      if (item.key === 'workspaces') {
        return (
          path === '/collaborate/workspaces' ||
          path === '/company/workspaces' ||
          path.startsWith('/collaborate/organizations') ||
          path.startsWith('/company/organizations') ||
          path.startsWith('/collaborate/join') ||
          path.startsWith('/company/join')
        );
      }
      if (item.key === 'chat') {
        return path === '/company/chat' || path.startsWith('/company/chat');
      }
      if (item.key === 'tasks') {
        return (
          path === '/collaborate/projects' ||
          path.startsWith('/collaborate/projects/') ||
          path.startsWith('/projects')
        );
      }
      if (item.key === 'documents') {
        return path === '/collaborate/documents' || path === '/company/documents';
      }
      if (item.key === 'calendar') {
        return path === '/collaborate/calendar' || path === '/company/calendar';
      }
      if (item.key === 'approvals') {
        return path === '/collaborate/approvals' || path === '/company/approvals';
      }
      return isActivePath(item.path);
    }
    return isActivePath(item.path);
  };

  const allowedSuites = useMemo(() => {
    const base = ['communicate', 'company', 'projects'];
    if (showManageSuite) return ['communicate', 'company', 'projects', 'manage'];
    return base;
  }, [showManageSuite]);
  const railCollapsed = collapsed && !mobileNavOpen;
  const widthClass = railCollapsed ? FIGMA_SIDEBAR_COLLAPSED : FIGMA_SIDEBAR_EXPANDED;
  const sidebarTranslate = mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0';
  const suitePickerOpen = showSuitePicker && !railCollapsed;

  return (

    <>
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label={t('common.close')}
          className="fixed inset-0 z-[240] bg-black/50 lg:hidden"
          onClick={closeMobileNav}
        />
      ) : null}
      <div
        id="atrium-mobile-nav"
        role={mobileNavOpen ? 'dialog' : undefined}
        aria-modal={mobileNavOpen ? true : undefined}
        aria-label={t('nav.mainMenu')}
        className={`${FIGMA_SIDEBAR} ${widthClass} fixed inset-y-0 left-0 z-[250] transform transition-transform duration-200 ease-enterprise lg:relative lg:z-30 lg:translate-x-0 ${sidebarTranslate}`}
      >
      <div className={`relative ${FIGMA_SIDEBAR_SUITE_STRIP}`}>
        <div
          className={`flex w-full items-center gap-1.5 ${railCollapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2'}`}
        >
          {!railCollapsed ? (
            <>
              <button
                type="button"
                onClick={() => setShowSuitePicker((s) => !s)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 transition"
                style={{
                  background: showSuitePicker ? `${suiteColor}28` : `${suiteColor}18`,
                  borderColor: `${suiteColor}${showSuitePicker ? '44' : '22'}`,
                }}
                title={t('nav.switchSuite')}
              >
                <div className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: suiteColor }} />
                <span
                  className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-[0.6875rem] font-bold uppercase tracking-wider"
                  style={{ color: suiteColor }}
                  title={suiteLabels.label}
                >
                  {suiteLabels.label}
                </span>
                <ChevronsRight
                  size={10}
                  className={`${VH_NAV_CHEVRON} ${showSuitePicker ? 'rotate-90' : 'rotate-0'}`}
                  style={{ color: suiteColor }}
                />
              </button>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden shrink-0 rounded-[5px] border-none bg-transparent p-0.5 text-white/30 transition hover:text-white/70 lg:inline-flex"
                title={t('nav.collapseSidebar')}
                aria-label={t('nav.collapseSidebar')}
              >
                <ChevronsLeft size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              title={t('nav.expandSidebar')}
              aria-label={t('nav.expandSidebar')}
              className={FIGMA_SIDEBAR_EXPAND_BTN}
              style={{
                background: `${suiteColor}18`,
                borderColor: `${suiteColor}44`,
                color: suiteColor,
              }}
            >
              <ChevronsRight size={14} strokeWidth={2.25} />
            </button>
          )}
        </div>

        <MotionPresence open={suitePickerOpen}>
          <motion.div
            key="suite-picker"
            className="absolute left-2 right-2 top-[calc(100%+4px)] z-[200] overflow-hidden rounded-xl border border-white/10 bg-[#0D0D1A] shadow-2xl vh-motion-respect"
            role="menu"
            {...motionPopover}
          >
              <div className="px-2.5 pb-1 pt-2 text-[0.575rem] font-bold uppercase tracking-widest text-white/25">
                {t('nav.chooseSpace')}
              </div>
              {allowedSuites.map((sId) => {
                const isCurrent = sId === suiteSegment;
                const labels = {
                  label: sId === 'manage' ? adminNavLabel : t(`nav.suite.${sId}.label`),
                  sublabel: t(`nav.suite.${sId}.sublabel`),
                };
                const sc = SUITE_COLORS[sId];
                return (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => {
                      const suiteMap = {
                        communicate: SUITE.COMMUNICATE,
                        company: SUITE.COMPANY,
                        projects: SUITE.PROJECTS,
                        collaborate: SUITE.COMPANY,
                        me: SUITE.ME,
                        manage: SUITE.MANAGE,
                      };
                      const targetSuite = suiteMap[sId];
                      const path =
                        sId === 'manage' ? adminNavPath : getDefaultPathForSuite(targetSuite);
                      navigateToSuite(targetSuite, { path });
                      setShowSuitePicker(false);
                    }}
                    className="flex w-full items-center gap-2.5 border-none px-3 py-2 text-left transition duration-fast ease-enterprise motion-reduce:transition-none"
                    style={{
                      background: isCurrent ? `${sc}18` : 'transparent',
                      borderLeft: `3px solid ${isCurrent ? sc : 'transparent'}`,
                    }}
                  >
                    <div
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: sc, boxShadow: isCurrent ? `0 0 6px ${sc}` : 'none' }}
                    />
                    <div>
                      <div
                        className="text-[0.7812rem]"
                        style={{
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? sc : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {labels.label}
                      </div>
                      <div className="text-[0.625rem] text-white/25">{labels.sublabel}</div>
                    </div>
                    {isCurrent && <ChevronsRight size={11} className="ml-auto" style={{ color: sc }} />}
                  </button>
                );
              })}
              <div className="h-1.5" />
          </motion.div>
        </MotionPresence>
      </div>

      {contextSwitch
        ? isValidElement(contextSwitch)
          ? cloneElement(contextSwitch, { collapsed: railCollapsed })
          : contextSwitch
        : null}

      {!railCollapsed && visibleNavItems.length > 0 ? (
        <div className={FIGMA_SIDEBAR_SECTION_LABEL}>{t('nav.mainMenu')}</div>
      ) : null}

      <nav className={FIGMA_SIDEBAR_NAV}>
        {visibleNavItems.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            collapsed={railCollapsed}
            suiteColor={suiteColor}
            isActive={isActiveNavItem(item)}
          />
        ))}
      </nav>

      <div className={FIGMA_SIDEBAR_FOOTER}>
        <SidebarPositionFooter collapsed={railCollapsed} wrap={false} />
      </div>
    </div>
    </>
  );
}
