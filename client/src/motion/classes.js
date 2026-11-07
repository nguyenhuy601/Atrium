/**
 * Class strings SoT — reuse thay vì invent Tailwind duration/easing.
 * @see .cursor/rules/enterprise-motion.mdc
 */

/** Micro: CTA / button */
export const VH_MOTION_BTN =
  'vh-motion-btn vh-motion-respect motion-reduce:transform-none';

/** Micro: text field / select focus */
export const VH_MOTION_FIELD =
  'vh-input-focus vh-motion-field vh-motion-respect motion-reduce:transform-none';

/** Micro: list/table row hover */
export const VH_MOTION_ROW = 'vh-motion-row vh-motion-respect';

/** Micro: optional card lift */
export const VH_MOTION_CARD =
  'vh-motion-card vh-motion-respect motion-reduce:hover:translate-y-0';

/**
 * Tab / page — chỉ token respect.
 * Enter/exit do TabPanelMotion / PageMotion (Motion) — không gắn CSS keyframes
 * (trùng opacity → chớp khi chuyển trang/tab).
 */
export const VH_MOTION_TAB_PANEL = 'vh-motion-respect';

/** Page / route outlet — dùng với PageMotion */
export const VH_MOTION_PAGE = 'vh-motion-respect';

/** Overlay shell — gắn data-motion-phase=enter|exit */
export const VH_PRESENCE_OVERLAY = 'vh-presence-overlay vh-motion-respect';

export const VH_PRESENCE_BACKDROP = 'vh-presence-backdrop';

export const VH_PRESENCE_PANEL = 'vh-presence-panel';

/**
 * CSS-only popover / dropdown (fade + slide + scale 220ms).
 * Menu Motion: dùng MotionMenu / motionPopover — không gắn class này (tránh đôi animation).
 */
export const VH_PRESENCE_POPOVER =
  'vh-presence-popover vh-motion-respect motion-reduce:animate-none';

export const VH_PRESENCE_DRAWER_RIGHT =
  'vh-presence-drawer vh-presence-drawer-right vh-motion-respect';

export const VH_PRESENCE_DRAWER_LEFT =
  'vh-presence-drawer vh-presence-drawer-left vh-motion-respect';

/** Toast enter */
export const VH_MOTION_TOAST =
  'vh-motion-respect motion-safe:animate-fade-in motion-reduce:animate-none';

/** Skeleton shimmer */
export const VH_MOTION_SKELETON = 'vh-skeleton vh-motion-respect rounded-md';

/** Spinner — tắt spin khi reduce */
export const VH_MOTION_SPINNER = 'animate-spin motion-reduce:animate-none';

/** Sidebar submenu / accordion — gắn data-open trên NavCollapse */
export const VH_NAV_COLLAPSE = 'vh-nav-collapse vh-motion-respect';


/** Chevron menu — xoay khi mở */
export const VH_NAV_CHEVRON =
  'shrink-0 opacity-70 transition-transform duration-[var(--vh-motion-base)] ease-[var(--vh-motion-ease)] motion-reduce:transition-none';
