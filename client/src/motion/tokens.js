/**
 * Enterprise motion tokens — sync với CSS vars `--vh-motion-*` trong index.css.
 * Motion (motion/react) + GSAP đọc cùng bộ token này — không invent duration/easing ad-hoc.
 * @see .cursor/rules/enterprise-motion.mdc
 */

export const VH_MOTION_FAST_MS = 100;
export const VH_MOTION_BASE_MS = 150;
export const VH_MOTION_SLOW_MS = 220;
/** Press feedback (active scale) — ngắn hơn fast */
export const VH_MOTION_PRESS_MS = 80;

export const VH_MOTION_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const VH_MOTION_EASE_OUT = 'cubic-bezier(0, 0, 0.2, 1)';
export const VH_MOTION_EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

/** Motion/WAAPI cubic-bezier tuples (cùng đường cong CSS tokens ở trên) */
export const VH_MOTION_EASE_BEZIER = [0.4, 0, 0.2, 1];
export const VH_MOTION_EASE_OUT_BEZIER = [0, 0, 0.2, 1];
export const VH_MOTION_EASE_IN_BEZIER = [0.4, 0, 1, 1];


/** Distance / scale — enterprise: subtle, no bounce */
export const VH_MOTION_Y_FADE_PX = 4;
export const VH_MOTION_X_SLIDE_PX = 8;
export const VH_MOTION_SCALE_PRESS = 0.97;
export const VH_MOTION_SCALE_HOVER = 1.01;
export const VH_MOTION_SCALE_PANEL = 0.96;

/** Overlay / modal / drawer enter-exit */
export const VH_MOTION_OVERLAY_MS = VH_MOTION_SLOW_MS;
/** Tab panel + page route fade */
export const VH_MOTION_PAGE_MS = VH_MOTION_BASE_MS;

/** GSAP ease aliases (power curves ≈ Material standard) */
export const VH_GSAP_EASE = 'power2.out';
export const VH_GSAP_EASE_IN = 'power2.in';
export const VH_GSAP_EASE_INOUT = 'power2.inOut';

export function msToSec(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / 1000;
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duration hiệu dụng — 0 khi OS reduced-motion. */
export function resolveMotionDuration(durationMs, reduced = prefersReducedMotion()) {
  const n = Number(durationMs);
  if (!Number.isFinite(n) || n < 0) return 0;
  return reduced ? 0 : n;
}
