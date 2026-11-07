import { Children, isValidElement } from 'react';
import { motion } from 'motion/react';
import { VH_MOTION_Y_FADE_PX, msToSec, VH_MOTION_FAST_MS } from '../tokens.js';
import { motionTransitionBase } from '../transitions.js';

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: msToSec(VH_MOTION_FAST_MS) * 0.55,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: VH_MOTION_Y_FADE_PX },
  show: { opacity: 1, y: 0, transition: motionTransitionBase },
};

/**
 * Stagger children enter — mỗi child hợp lệ được wrap motion.div.
 * `as` = thẻ container (div mặc định); props còn lại forward lên container.
 */
export default function MotionStagger({
  children,
  className = '',
  as: Component = 'div',
  /** Class trên wrapper từng child — dùng `h-full min-w-0` để grid cards cao đều. */
  itemClassName = '',
  ...rest
}) {
  const MotionTag = motion[Component] || motion.div;
  return (
    <MotionTag
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div
            key={child.key ?? index}
            className={itemClassName || undefined}
            variants={itemVariants}
          >
            {child}
          </motion.div>
        );
      })}
    </MotionTag>
  );
}
