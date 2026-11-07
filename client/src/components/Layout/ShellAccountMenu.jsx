import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Languages, LayoutDashboard, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
import { useAppStrings } from '../../locales/appStrings';
import { getUserDisplayName } from '../../utils/helpers';
import UserAvatar from '../Shared/UserAvatar';
import MotionMenu from '../../motion/primitives/MotionMenu';
import { VH_MOTION_BTN, VH_MOTION_ROW } from '../../motion/classes';

const MENU_WIDTH = 240;
const MENU_GAP = 6;

/**
 * Avatar + account dropdown (profile / locale / theme / logout).
 * Sidebar variant: portal menu (tránh clip overflow sidebar) + khung gộp role/position.
 */
export default function ShellAccountMenu({
  roleBadges = [],
  /** Project role chips for sidebar card: { key, label, title?, className } */
  roleChips = [],
  /** Org role label (picker / no project chips) */
  orgRoleLabel = '',
  /** Org position label */
  positionLabel = '',
  /** surface = light header; sidebar = dark rail */
  variant = 'surface',
  /** Menu opens upward (sidebar footer) or downward (header) */
  menuPlacement = 'below',
  /** Avatar only (collapsed sidebar rail) */
  compact = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState(null);
  const rootRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { locale, toggleLocale } = useLocale();
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useAppStrings();

  const displayName = getUserDisplayName(user);
  const profileUserId = user?.userId || user?.id || user?._id || null;
  const profileAvatar = user?.avatar || user?.avatarUrl || null;
  const profileAvatarBust = user?.avatarCacheKey || profileAvatar || undefined;
  const isSidebar = variant === 'sidebar';
  const openUp = menuPlacement === 'above';
  const usePortal = isSidebar && openUp;

  useLayoutEffect(() => {
    if (!open || !usePortal || !rootRef.current) {
      setMenuBox(null);
      return undefined;
    }
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = MENU_WIDTH;
      // Mở sang phải cạnh khung identity — không che nav sidebar, không clip overflow.
      const preferredLeft = rect.right + MENU_GAP;
      const left =
        preferredLeft + width <= window.innerWidth - 8
          ? preferredLeft
          : Math.max(8, rect.left - width - MENU_GAP);
      setMenuBox({
        left,
        width,
        bottom: Math.max(8, window.innerHeight - rect.bottom),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, usePortal]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        const portalEl = document.getElementById('shell-account-menu-portal');
        if (portalEl && portalEl.contains(e.target)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    navigate('/login');
  };

  const handleLocaleToggle = () => {
    toggleLocale();
    toast.success(locale === 'vi' ? t('header.localeToastEn') : t('header.localeToastVi'));
  };

  const popupBadges =
    roleBadges.length > 0
      ? roleBadges
      : roleChips.slice(0, 4).map((c) => ({
          key: c.key,
          short: c.label,
          className: c.className,
        }));

  const menuBody = (
    <div className="overflow-hidden rounded-xl">
      <div className="border-b border-border px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <UserAvatar
            avatar={profileAvatar}
            userId={profileUserId}
            name={displayName || user?.email || 'U'}
            size="sm"
            cacheBust={profileAvatarBust}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
            <div className="truncate text-[0.6875rem] text-muted-foreground">{user?.email}</div>
            {popupBadges.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {popupBadges.map((b) => (
                  <span
                    key={b.key}
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide ${b.className}`}
                  >
                    {b.short}
                  </span>
                ))}
              </div>
            ) : null}
            {positionLabel ? (
              <p className="mt-1 truncate text-[0.625rem] text-muted-foreground" title={positionLabel}>
                {positionLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            navigate('/me/settings');
          }}
          className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-foreground hover:bg-muted ${VH_MOTION_ROW}`}
        >
          <User size={14} className="shrink-0 text-muted-foreground" aria-hidden />
          {t('nav.myProfile')}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            navigate('/me/dashboard');
          }}
          className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-foreground hover:bg-muted ${VH_MOTION_ROW}`}
        >
          <LayoutDashboard size={14} className="shrink-0 text-muted-foreground" aria-hidden />
          {t('nav.overview')}
        </button>
        <div className="my-0.5 h-px bg-border" aria-hidden />
        <button
          type="button"
          role="menuitem"
          onClick={handleLocaleToggle}
          className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-foreground hover:bg-muted ${VH_MOTION_ROW}`}
          aria-label={t('nav.ariaLang')}
        >
          <Languages size={14} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-left">
            {locale === 'vi' ? t('header.switchLocaleEn') : t('header.switchLocaleVi')}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-muted-foreground">
            {({ en: 'EN', vi: 'VI' }[locale] || 'VI')}
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={toggleTheme}
          className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-foreground hover:bg-muted ${VH_MOTION_ROW}`}
        >
          <span className="shrink-0 text-sm leading-none" aria-hidden>
            {isDarkMode ? '☀️' : '🌙'}
          </span>
          {isDarkMode ? t('nav.themeLight') : t('nav.themeDark')}
        </button>
        <div className="my-0.5 h-px bg-border" aria-hidden />
        <button
          type="button"
          role="menuitem"
          onClick={handleLogout}
          className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-error hover:bg-error/10 ${VH_MOTION_ROW}`}
        >
          <span className="shrink-0 text-sm leading-none" aria-hidden>
            ↩
          </span>
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );

  const portalMenu =
    usePortal && typeof document !== 'undefined'
      ? createPortal(
          <div id="shell-account-menu-portal">
            <MotionMenu
              open={Boolean(open && menuBox)}
              menuKey="shell-account-menu"
              placement="up"
              className="fixed z-[280] rounded-xl border border-border bg-surface shadow-xl"
              style={
                menuBox
                  ? {
                      left: menuBox.left,
                      bottom: menuBox.bottom,
                      width: menuBox.width,
                    }
                  : undefined
              }
            >
              {menuBody}
            </MotionMenu>
          </div>,
          document.body
        )
      : null;

  const inlineMenu = !usePortal ? (
    <MotionMenu
      open={open}
      menuKey="shell-account-menu"
      placement={openUp ? 'up' : 'down'}
      className={`absolute z-[100] w-[240px] rounded-xl border border-border bg-surface shadow-xl ${
        openUp ? 'bottom-[calc(100%+6px)] right-0' : 'right-0 top-[calc(100%+6px)]'
      }`}
    >
      {menuBody}
    </MotionMenu>
  ) : null;

  if (isSidebar && compact) {
    const tip = [displayName, ...roleChips.map((c) => c.label), positionLabel || orgRoleLabel]
      .filter(Boolean)
      .join(' · ');
    return (
      <div className={`relative flex justify-center ${className}`} ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('nav.profileAccount')}
          title={tip}
          className={`flex items-center justify-center rounded-lg p-1 hover:bg-white/10 ${VH_MOTION_BTN}`}
          style={open ? { background: 'rgba(255,255,255,0.08)' } : undefined}
        >
          <UserAvatar
            avatar={profileAvatar}
            userId={profileUserId}
            name={displayName || user?.email || 'U'}
            size="xs"
            cacheBust={profileAvatarBust}
          />
        </button>
        {portalMenu}
        {inlineMenu}
      </div>
    );
  }

  if (isSidebar) {
    return (
      <div className={`relative ${className}`} ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('nav.profileAccount')}
          className={`flex w-full flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left hover:bg-white/[0.08] ${VH_MOTION_BTN}`}
          style={open ? { background: 'rgba(255,255,255,0.1)' } : undefined}
        >
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              avatar={profileAvatar}
              userId={profileUserId}
              name={displayName || user?.email || 'U'}
              size="xs"
              cacheBust={profileAvatarBust}
            />
            <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-semibold text-white/80">
              {displayName || user?.email || t('nav.profileAccount')}
            </span>
          </span>
          {roleChips.length ? (
            <span className="flex flex-wrap gap-1">
              {roleChips.map((chip) => (
                <span
                  key={chip.key}
                  title={chip.title || chip.label}
                  className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wide ${chip.className}`}
                >
                  {chip.label}
                </span>
              ))}
            </span>
          ) : orgRoleLabel ? (
            <span
              title={orgRoleLabel}
              className="inline-flex max-w-full truncate rounded border border-sky-300/35 bg-sky-400/25 px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wide !text-sky-50"
            >
              {orgRoleLabel}
            </span>
          ) : null}
          {positionLabel ? (
            <span className="flex min-w-0 items-center gap-1 text-[0.55rem] text-white/45">
              <Briefcase size={9} className="shrink-0" aria-hidden />
              <span className="truncate" title={positionLabel}>
                {positionLabel}
              </span>
            </span>
          ) : null}
        </button>
        {portalMenu}
        {inlineMenu}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('nav.profileAccount')}
        className={`flex items-center gap-1.5 rounded-lg p-1 ${VH_MOTION_BTN}`}
        style={{ background: open ? 'var(--muted)' : 'transparent' }}
      >
        <UserAvatar
          avatar={profileAvatar}
          userId={profileUserId}
          name={displayName || user?.email || 'U'}
          size="xs"
          cacheBust={profileAvatarBust}
          ringClassName="shadow-md"
        />
      </button>
      {inlineMenu}
    </div>
  );
}
