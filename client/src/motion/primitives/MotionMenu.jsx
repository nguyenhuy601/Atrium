import { forwardRef } from 'react';
import { motion } from 'motion/react';
import MotionPresence from './MotionPresence.jsx';
import { motionPopover, motionPopoverUp } from '../overlayMotion.js';

/**
 * Dropdown / menu SoT — Presence + popover variant (không CSS keyframes song song).
 * Feature compose primitive này thay vì tự spread + AnimatePresence.
 */
const MotionMenu = forwardRef(function MotionMenu(
  {
    open,
    children,
    className = '',
    placement = 'down',
    role = 'menu',
    menuKey = 'vh-motion-menu',
    onExitComplete,
    ...rest
  },
  ref
) {
  const variant = placement === 'up' ? motionPopoverUp : motionPopover;
  const origin =
    placement === 'up'
      ? 'origin-bottom'
      : className.includes('right-0')
        ? 'origin-top-right'
        : 'origin-top';

  return (
    <MotionPresence open={open} initial onExitComplete={onExitComplete}>
      <motion.div
        ref={ref}
        key={menuKey}
        role={role}
        className={`${origin} ${className}`.trim()}
        initial={variant.initial}
        animate={variant.animate}
        exit={variant.exit}
        transition={variant.transition}
        {...rest}
      >
        {children}
      </motion.div>
    </MotionPresence>
  );
});

export default MotionMenu;
