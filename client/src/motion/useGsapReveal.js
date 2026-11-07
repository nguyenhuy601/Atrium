import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  VH_GSAP_EASE,
  VH_MOTION_BASE_MS,
  VH_MOTION_Y_FADE_PX,
  msToSec,
  resolveMotionDuration,
} from './tokens.js';
import { ensureGsapDefaults } from './gsapSetup.js';

/**
 * Stagger fade-up children khi mount — dùng cho lab / panel list.
 * Respects prefers-reduced-motion via gsap.matchMedia.
 *
 * @param {{ selector?: string, stagger?: number, deps?: unknown[] }} [options]
 */
export default function useGsapReveal(options = {}) {
  const { selector = '[data-motion-reveal-item]', stagger = 0.05, deps = [] } = options;
  const containerRef = useRef(null);

  useGSAP(
    () => {
      ensureGsapDefaults();
      const root = containerRef.current;
      if (!root) return undefined;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          allowMotion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduce = Boolean(context.conditions?.reduceMotion);
          const items = root.querySelectorAll(selector);
          if (!items.length) return undefined;

          const duration = msToSec(resolveMotionDuration(VH_MOTION_BASE_MS, reduce));
          if (duration === 0) {
            gsap.set(items, { clearProps: 'opacity,transform' });
            return undefined;
          }

          gsap.fromTo(
            items,
            { autoAlpha: 0, y: VH_MOTION_Y_FADE_PX },
            {
              autoAlpha: 1,
              y: 0,
              duration,
              ease: VH_GSAP_EASE,
              stagger,
              clearProps: 'transform',
            }
          );
          return undefined;
        },
        root
      );

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: deps }
  );

  return containerRef;
}
