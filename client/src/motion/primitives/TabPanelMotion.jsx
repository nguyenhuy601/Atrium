import { AnimatePresence, motion } from 'motion/react';
import { motionTransitionBase } from '../transitions.js';

/**
 * Nội dung tab — fade opacity khi đổi `activeKey`.
 * Không gắn CSS animate-fade-in (trùng Motion → chớp).
 */
export default function TabPanelMotion({
  activeKey,
  children,
  className = '',
  mode = 'wait',
}) {
  return (
    <AnimatePresence mode={mode} initial={false}>
      <motion.div
        key={activeKey}
        className={`vh-motion-respect ${className}`.trim()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={motionTransitionBase}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
