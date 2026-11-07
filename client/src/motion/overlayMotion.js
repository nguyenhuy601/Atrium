/**
 * Motion variants cho overlay enterprise — thay CSS data-motion-phase.
 * Duration/ease từ tokens; không bounce.
 *
 * Lưu ý: không gắn Tailwind translate-* trên cùng node đang animate transform
 * (x/y/scale) — sẽ nuốt enter/exit.
 *
 * Variant shape: top-level `transition` cho enter; `exit.transition` cho exit
 * (Motion đọc ổn định hơn khi nested transition chỉ nằm trong animate).
 */
import {
  VH_MOTION_SCALE_PANEL,
  VH_MOTION_X_SLIDE_PX,
  VH_MOTION_Y_FADE_PX,
} from './tokens.js';
import { motionTransitionExit, motionTransitionSlow } from './transitions.js';

export const overlayEnterTransition = motionTransitionSlow;
export const overlayExitTransition = motionTransitionExit;

/**
 * Shell fixed-inset bọc backdrop + panel.
 * Phải là object ổn định (module scope) — inline `{ opacity: 1 }` mỗi render
 * sẽ làm Motion restart / đơ enter giữa chừng.
 */
export const motionOverlayShell = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: overlayExitTransition },
};

/** Backdrop fade — enter/exit tách ease */
export const motionBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: overlayExitTransition },
  transition: overlayEnterTransition,
};

/** Modal panel — scale + slide ngắn */
export const motionModalPanel = {
  initial: { opacity: 0, scale: VH_MOTION_SCALE_PANEL, y: VH_MOTION_X_SLIDE_PX },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: {
    opacity: 0,
    scale: VH_MOTION_SCALE_PANEL,
    y: VH_MOTION_Y_FADE_PX,
    transition: overlayExitTransition,
  },
  transition: overlayEnterTransition,
};

export const motionDrawerRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%', transition: overlayExitTransition },
  transition: overlayEnterTransition,
};

export const motionDrawerLeft = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%', transition: overlayExitTransition },
  transition: overlayEnterTransition,
};

/**
 * Popover / dropdown mở xuống (menu dưới trigger).
 * Fade + slide + scale rõ hơn opacity-only (tránh cảm giác “nhảy liền”).
 * Thêm `origin-top` / `origin-top-right` trên className.
 */
export const motionPopover = {
  initial: {
    opacity: 0,
    y: -VH_MOTION_X_SLIDE_PX,
    scale: VH_MOTION_SCALE_PANEL,
  },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    y: -VH_MOTION_Y_FADE_PX,
    scale: VH_MOTION_SCALE_PANEL,
    transition: overlayExitTransition,
  },
  transition: {
    ...overlayEnterTransition,
    opacity: overlayEnterTransition,
    y: overlayEnterTransition,
    scale: overlayEnterTransition,
  },
};

/** Popover mở lên (bulk bar, menu phía trên trigger) — thêm `origin-bottom` */
export const motionPopoverUp = {
  initial: {
    opacity: 0,
    y: VH_MOTION_X_SLIDE_PX,
    scale: VH_MOTION_SCALE_PANEL,
  },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    y: VH_MOTION_Y_FADE_PX,
    scale: VH_MOTION_SCALE_PANEL,
    transition: overlayExitTransition,
  },
  transition: {
    ...overlayEnterTransition,
    opacity: overlayEnterTransition,
    y: overlayEnterTransition,
    scale: overlayEnterTransition,
  },
};

export const motionToast = {
  initial: { opacity: 0, y: VH_MOTION_Y_FADE_PX * 2, x: VH_MOTION_X_SLIDE_PX },
  animate: { opacity: 1, y: 0, x: 0 },
  exit: {
    opacity: 0,
    y: VH_MOTION_Y_FADE_PX,
    x: VH_MOTION_X_SLIDE_PX,
    transition: overlayExitTransition,
  },
  transition: overlayEnterTransition,
};

/** Exit dùng ease-in riêng khi cần override transition trên exit */
export const withOverlayExit = (variant) => ({
  ...variant,
  transition: {
    ...variant.transition,
    opacity: overlayEnterTransition,
  },
  exit: {
    ...variant.exit,
    transition: overlayExitTransition,
  },
});
