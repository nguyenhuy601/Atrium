import { motion } from 'motion/react';
import { VH_MOTION_Y_FADE_PX } from '../tokens.js';
import { motionTransitionBase } from '../transitions.js';

/**
 * Enter fade/slide ngắn — opacity vẫn chạy khi reduced-motion (MotionConfig user).
 */
export default function MotionFadeIn({
  children,
  className = '',
  delay = 0,
  y = VH_MOTION_Y_FADE_PX,
  as: Component = 'div',
  ...rest
}) {
  const MotionTag = motion[Component] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTransitionBase, delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
