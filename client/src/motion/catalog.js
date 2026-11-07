/**
 * Enterprise Motion Catalog — mọi bề mặt Atrium có thể animate.
 * Engine chỉ trong `client/src/motion/`; feature compose primitive/class.
 *
 * status: ready = primitive/class sẵn · partial = CSS/token có, wire lẻ · planned = SoT khóa, chưa primitive riêng
 */

export const MOTION_SURFACE = {
  /** Micro controls */
  button: {
    id: 'button',
    status: 'ready',
    engine: 'motion+css',
    primitive: 'MotionButton / VH_MOTION_BTN',
  },
  textField: {
    id: 'textField',
    status: 'ready',
    engine: 'motion+gsap+css',
    primitive: 'MotionTextField / VH_MOTION_FIELD',
  },
  rowHover: {
    id: 'rowHover',
    status: 'ready',
    engine: 'css',
    primitive: 'VH_MOTION_ROW',
  },
  cardHover: {
    id: 'cardHover',
    status: 'ready',
    engine: 'css',
    primitive: 'VH_MOTION_CARD',
  },

  /** Navigation & structure */
  pageRoute: {
    id: 'pageRoute',
    status: 'ready',
    engine: 'motion+css',
    primitive: 'PageMotion',
  },
  tabPanel: {
    id: 'tabPanel',
    status: 'ready',
    engine: 'motion+css',
    primitive: 'TabPanelMotion / VH_MOTION_TAB_PANEL',
  },
  tabIndicator: {
    id: 'tabIndicator',
    status: 'ready',
    engine: 'motion',
    primitive: 'TabIndicator (layoutId)',
  },
  navCollapse: {
    id: 'navCollapse',
    status: 'ready',
    engine: 'css',
    primitive: 'NavCollapse',
  },

  /** Overlays */
  modal: {
    id: 'modal',
    status: 'ready',
    engine: 'motion',
    primitive: 'MotionPresence + motionModalPanel',
  },
  drawer: {
    id: 'drawer',
    status: 'ready',
    engine: 'motion',
    primitive: 'MotionPresence + motionDrawerRight/Left',
  },
  popover: {
    id: 'popover',
    status: 'ready',
    engine: 'motion',
    primitive: 'MotionPresence + motionPopover',
  },
  toast: {
    id: 'toast',
    status: 'ready',
    engine: 'motion',
    primitive: 'Toast + motionToast',
  },


  /** Data & async */
  pageLoader: {
    id: 'pageLoader',
    status: 'ready',
    engine: 'motion+css',
    primitive: 'BrandPageLoader + FetchBar + PageLoaderBar + VH_MOTION_SPINNER',
  },
  shellHeaderLoading: {
    id: 'shellHeaderLoading',
    status: 'ready',
    engine: 'motion+css',
    primitive: 'TopHeader MotionPresence + FetchBar + data-testid=shell-header-loading',
  },
  skeleton: {
    id: 'skeleton',
    status: 'ready',
    engine: 'css',
    primitive: 'VH_MOTION_SKELETON / SkeletonBlock',
  },
  fetchBar: {
    id: 'fetchBar',
    status: 'ready',
    engine: 'motion',
    primitive: 'FetchBar (isFetching)',
  },
  inlineBusy: {
    id: 'inlineBusy',
    status: 'ready',
    engine: 'css',
    primitive: 'VH_MOTION_SPINNER / InlineBusy',
  },
  queryState: {
    id: 'queryState',
    status: 'ready',
    engine: 'motion+css',
    primitive: 'QueryStateView (skeleton + content fade)',
  },
  listReveal: {
    id: 'listReveal',
    status: 'ready',
    engine: 'gsap',
    primitive: 'useGsapReveal',
  },

  /** Scroll */
  scrollReveal: {
    id: 'scrollReveal',
    status: 'ready',
    engine: 'gsap',
    primitive: 'useScrollReveal (ScrollTrigger)',
  },
  scrollProgress: {
    id: 'scrollProgress',
    status: 'ready',
    engine: 'motion',
    primitive: 'ScrollProgressBar',
  },

  /** Domain exceptions — không SoT-general */
  waveform: { id: 'waveform', status: 'planned', engine: 'domain', primitive: 'VoiceSpeakingWaveform' },
  boardDnd: { id: 'boardDnd', status: 'planned', engine: 'domain', primitive: '@dnd-kit + CSS' },
};

export const MOTION_SURFACE_LIST = Object.values(MOTION_SURFACE);
