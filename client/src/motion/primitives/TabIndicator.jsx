import { motion } from 'motion/react';
import { motionTransitionBase } from '../transitions.js';

/**
 * Pill/underline trượt giữa tab — mỗi Tablist cần `layoutId` unique (vd. useId).
 */
export default function TabIndicator({
  layoutId,
  className = 'absolute inset-0 rounded-lg bg-primary shadow-sm',
  style,
}) {
  return (
    <motion.span
      layoutId={layoutId}
      className={className}
      style={style}
      transition={motionTransitionBase}
      aria-hidden
    />
  );
}
