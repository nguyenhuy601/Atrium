import { motion } from 'motion/react';
import { motionTransitionSlow } from '../transitions.js';

/**
 * Thanh indeterminate giữa trang loader — cùng ngôn ngữ FetchBar (opacity + translateX).
 */
export default function PageLoaderBar({
  className = '',
  label = 'Loading',
}) {
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-valuetext={label}
      data-testid="vh-page-loader-bar"
      className={`h-1 w-40 overflow-hidden rounded-full bg-primary/15 ${className}`.trim()}
    >
      <motion.div
        className="h-full w-2/5 rounded-full bg-primary"
        initial={{ x: '-120%' }}
        animate={{ x: '280%' }}
        transition={{
          ...motionTransitionSlow,
          repeat: Infinity,
          ease: 'linear',
          duration: 1.15,
        }}
      />
    </div>
  );
}
