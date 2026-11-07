import { motion, useScroll, useSpring } from 'motion/react';

/**
 * Progress đọc trang theo scroll — gắn cố định top (docs / long report).
 */
export default function ScrollProgressBar({ className = '' }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    restDelta: 0.001,
  });

  return (
    <motion.div
      data-testid="vh-scroll-progress"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[9997] h-0.5 origin-left bg-primary ${className}`.trim()}
      style={{ scaleX }}
    />
  );
}
