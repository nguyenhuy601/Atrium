export {
  VH_MOTION_FAST_MS,
  VH_MOTION_BASE_MS,
  VH_MOTION_SLOW_MS,
  VH_MOTION_PRESS_MS,
  VH_MOTION_EASE,
  VH_MOTION_EASE_OUT,
  VH_MOTION_EASE_IN,
  VH_MOTION_EASE_BEZIER,
  VH_MOTION_EASE_OUT_BEZIER,
  VH_MOTION_EASE_IN_BEZIER,
  VH_MOTION_OVERLAY_MS,
  VH_MOTION_PAGE_MS,
  VH_MOTION_Y_FADE_PX,
  VH_MOTION_X_SLIDE_PX,
  VH_MOTION_SCALE_PRESS,
  VH_MOTION_SCALE_HOVER,
  VH_MOTION_SCALE_PANEL,
  VH_GSAP_EASE,
  VH_GSAP_EASE_IN,
  VH_GSAP_EASE_INOUT,
  prefersReducedMotion,
  resolveMotionDuration,
  msToSec,
} from './tokens.js';

export {
  VH_MOTION_BTN,
  VH_MOTION_FIELD,
  VH_MOTION_ROW,
  VH_MOTION_CARD,
  VH_MOTION_TAB_PANEL,
  VH_MOTION_PAGE,
  VH_PRESENCE_OVERLAY,
  VH_PRESENCE_BACKDROP,
  VH_PRESENCE_PANEL,
  VH_PRESENCE_POPOVER,
  VH_PRESENCE_DRAWER_RIGHT,
  VH_PRESENCE_DRAWER_LEFT,
  VH_MOTION_TOAST,
  VH_MOTION_SKELETON,
  VH_MOTION_SPINNER,
  VH_NAV_COLLAPSE,
  VH_NAV_CHEVRON,
} from './classes.js';

export {
  motionTransitionFast,
  motionTransitionBase,
  motionTransitionPress,
  motionTransitionSlow,
  motionTransitionExit,
  motionButtonHover,
  motionButtonTap,
  motionButtonTransition,
  motionFieldFocus,
  motionFadeUp,
} from './transitions.js';

export { MOTION_SURFACE, MOTION_SURFACE_LIST } from './catalog.js';

export {
  motionBackdrop,
  motionModalPanel,
  motionDrawerRight,
  motionDrawerLeft,
  motionPopover,
  motionPopoverUp,
  motionToast,
  motionOverlayShell,
  overlayEnterTransition,
  overlayExitTransition,
} from './overlayMotion.js';

export {
  PRESENCE_PHASE,
  presenceReducer,
  initialPresenceState,
} from './presenceState.js';

/** @deprecated Prefer MotionPresence + overlayMotion variants */
export { default as useMotionPresence } from './useMotionPresence.js';
export { default as useOverlayScrollLock } from './useOverlayScrollLock.js';
export { default as PageMotion } from './PageMotion.jsx';
export { default as NavCollapse } from './NavCollapse.jsx';
export { default as MotionProvider } from './MotionProvider.jsx';
export { default as useGsapReveal } from './useGsapReveal.js';
export { default as useScrollReveal } from './useScrollReveal.js';
export { ensureGsapDefaults, createMotionMatchMedia, gsapFieldInvalidPulse, gsap } from './gsapSetup.js';
export { default as MotionButton } from './primitives/MotionButton.jsx';
export { default as MotionTextField } from './primitives/MotionTextField.jsx';
export { default as MotionFadeIn } from './primitives/MotionFadeIn.jsx';
export { default as MotionStagger } from './primitives/MotionStagger.jsx';
export { default as MotionPresence } from './primitives/MotionPresence.jsx';
export { default as MotionMenu } from './primitives/MotionMenu.jsx';

export { default as TabPanelMotion } from './primitives/TabPanelMotion.jsx';
export { default as TabIndicator } from './primitives/TabIndicator.jsx';
export { default as FetchBar } from './primitives/FetchBar.jsx';
export { default as PageLoaderBar } from './primitives/PageLoaderBar.jsx';
export { default as ScrollProgressBar } from './primitives/ScrollProgressBar.jsx';
export { default as SkeletonBlock } from './primitives/SkeletonBlock.jsx';
export { default as InlineBusy } from './primitives/InlineBusy.jsx';

