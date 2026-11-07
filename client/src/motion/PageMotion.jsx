import { AnimatePresence, motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { motionTransitionBase } from './transitions.js';

/**
 * Fade nhẹ khi đổi route — chỉ opacity (không CSS keyframes, không slide Y).
 * Tránh chớp: CSS `animate-fade-in-fast` + Motion cùng lúc; mode wait + y shift.
 */
export default function PageMotion({ children, className = '' }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
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
