import { MotionConfig } from 'motion/react';

/**
 * Root Motion config — reducedMotion theo OS (transform/layout tắt, opacity/color giữ).
 * Wrap gần App; feature pages không import motion/react trực tiếp.
 */
export default function MotionProvider({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
