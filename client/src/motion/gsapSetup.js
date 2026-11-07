/**
 * GSAP defaults gắn Enterprise Motion tokens.
 * Chỉ gọi từ hook/primitive trong `client/src/motion/` — không gsap trực tiếp trên feature pages.
 */
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  VH_GSAP_EASE,
  VH_MOTION_BASE_MS,
  msToSec,
  prefersReducedMotion,
  resolveMotionDuration,
} from './tokens.js';

const FIELD_INVALID_X_PX = 6;

let defaultsApplied = false;
let pluginRegistered = false;

function registerGsapReactPlugin() {
  if (pluginRegistered) return;
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  pluginRegistered = true;
}


export function ensureGsapDefaults() {
  registerGsapReactPlugin();
  if (defaultsApplied) return;
  gsap.defaults({
    duration: msToSec(VH_MOTION_BASE_MS),
    ease: VH_GSAP_EASE,
    overwrite: 'auto',
  });
  defaultsApplied = true;
}

/**
 * matchMedia scoped — auto-revert khi unmount / breakpoint đổi.
 * @param {Element|string|null} scope
 * @param {(ctx: { reduceMotion: boolean, gsap: typeof gsap }) => void|(() => void)} setup
 */
export function createMotionMatchMedia(scope, setup) {
  ensureGsapDefaults();
  const mm = gsap.matchMedia();
  mm.add(
    {
      reduceMotion: '(prefers-reduced-motion: reduce)',
      allowMotion: '(prefers-reduced-motion: no-preference)',
    },
    (context) => {
      const reduceMotion = Boolean(context.conditions?.reduceMotion);
      return setup({ reduceMotion, gsap, context });
    },
    scope || undefined
  );
  return mm;
}

/** Shake nhẹ khi validation lỗi — tắt khi reduced-motion. */
export function gsapFieldInvalidPulse(el, { reduced = prefersReducedMotion() } = {}) {
  if (!el) return null;
  ensureGsapDefaults();
  const duration = msToSec(resolveMotionDuration(VH_MOTION_BASE_MS, reduced));
  if (duration === 0) return null;
  return gsap.fromTo(
    el,
    { x: -FIELD_INVALID_X_PX },
    {
      x: 0,
      duration,
      ease: 'power2.out',
      clearProps: 'x',
    }
  );
}

export { gsap };
