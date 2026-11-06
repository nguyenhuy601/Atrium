import { useEffect, useState } from 'react';
import usePrefersReducedMotion from './usePrefersReducedMotion';

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/**
 * Animate number 0 → target (or previous → target). Snap when reduce-motion.
 * @param {number} target
 * @param {{ durationMs?: number, decimals?: number }} [opts]
 */
export default function useCountUp(target, opts = {}) {
  const durationMs = opts.durationMs ?? 800;
  const decimals = opts.decimals ?? 0;
  const reduceMotion = usePrefersReducedMotion();
  const numeric = Number(target);
  const safeTarget = Number.isFinite(numeric) ? numeric : 0;
  const [value, setValue] = useState(reduceMotion ? safeTarget : 0);

  useEffect(() => {
    if (reduceMotion) {
      setValue(safeTarget);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const run = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = from + (safeTarget - from) * easeOutExpo(t);
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [safeTarget, durationMs, reduceMotion]);

  if (decimals <= 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
