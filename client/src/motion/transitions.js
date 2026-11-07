/**
 * Motion (motion/react) transition presets — map từ Enterprise Motion tokens.
 * Ease phải là tuple/cubic-bezier array — không dùng chuỗi CSS `cubic-bezier(...)`.
 */
import {
  VH_MOTION_BASE_MS,
  VH_MOTION_EASE_BEZIER,
  VH_MOTION_EASE_IN_BEZIER,
  VH_MOTION_EASE_OUT_BEZIER,
  VH_MOTION_FAST_MS,
  VH_MOTION_PRESS_MS,
  VH_MOTION_SCALE_HOVER,
  VH_MOTION_SCALE_PRESS,
  VH_MOTION_SLOW_MS,
  VH_MOTION_Y_FADE_PX,
  msToSec,
} from './tokens.js';

/** Micro interaction (hover color / row) */
export const motionTransitionFast = {
  duration: msToSec(VH_MOTION_FAST_MS),
  ease: VH_MOTION_EASE_BEZIER,
};

/** Button / input / tab */
export const motionTransitionBase = {
  duration: msToSec(VH_MOTION_BASE_MS),
  ease: VH_MOTION_EASE_BEZIER,
};

/** Press feedback */
export const motionTransitionPress = {
  duration: msToSec(VH_MOTION_PRESS_MS),
  ease: VH_MOTION_EASE_BEZIER,
};

/** Overlay / drawer / page */
export const motionTransitionSlow = {
  duration: msToSec(VH_MOTION_SLOW_MS),
  ease: VH_MOTION_EASE_OUT_BEZIER,
};

export const motionTransitionExit = {
  duration: msToSec(VH_MOTION_SLOW_MS),
  ease: VH_MOTION_EASE_IN_BEZIER,
};

/** CTA hover / tap — enterprise: subtle, no bounce */
export const motionButtonHover = { scale: VH_MOTION_SCALE_HOVER };
export const motionButtonTap = { scale: VH_MOTION_SCALE_PRESS };

export const motionButtonTransition = {
  scale: motionTransitionPress,
  opacity: motionTransitionBase,
};

/** Field focus lift (opacity/transform only) */
export const motionFieldFocus = {
  y: -VH_MOTION_Y_FADE_PX / 4,
};

export const motionFadeUp = {
  initial: { opacity: 0, y: VH_MOTION_Y_FADE_PX },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: VH_MOTION_Y_FADE_PX / 2 },
  transition: motionTransitionBase,
};
