import { AnimatePresence, motion } from 'motion/react';
import { motionTransitionFast, motionTransitionSlow } from '../transitions.js';

/**
 * Thanh mỏng khi React Query / S2S đang fetch nền (không block UI).
 */
export default function FetchBar({ active = false, className = '' }) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="vh-fetch-bar"
          role="progressbar"
          aria-busy="true"
          aria-valuetext="Loading"
          data-testid="vh-fetch-bar"
          className={`pointer-events-none fixed inset-x-0 top-0 z-[9998] h-0.5 origin-left overflow-hidden bg-primary/20 ${className}`.trim()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransitionFast}
        >
          <motion.div
            className="h-full w-1/3 bg-primary"
            initial={{ x: '-100%' }}
            animate={{ x: '400%' }}
            transition={{
              ...motionTransitionSlow,
              repeat: Infinity,
              ease: 'linear',
              duration: 1.1,
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
