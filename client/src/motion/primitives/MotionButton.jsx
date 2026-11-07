import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { VH_MOTION_BTN } from '../classes.js';
import {
  motionButtonHover,
  motionButtonTap,
  motionButtonTransition,
} from '../transitions.js';
import InlineBusy from './InlineBusy.jsx';

/**
 * Enterprise CTA — Motion press/hover + CSS `vh-motion-btn`.
 * `busy` → spinner tức thì + khóa hover/tap.
 */
const MotionButton = forwardRef(function MotionButton(
  {
    children,
    className = '',
    type = 'button',
    disabled = false,
    disableMotion = false,
    busy = false,
    busyLabel,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || busy;
  const classes = `${VH_MOTION_BTN} ${className}`.trim();

  // Busy: spinner + children (hoặc busyLabel nếu truyền). Không nuốt children mặc định.
  const content = busy ? (
    <span className="inline-flex items-center justify-center gap-2" data-motion-busy="">
      <InlineBusy label={busyLabel || 'Loading'} className="border-current border-t-transparent" />
      {busyLabel ? <span>{busyLabel}</span> : children}
    </span>
  ) : (
    <span className="inline-flex items-center justify-center gap-2">{children}</span>
  );

  if (disableMotion) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={busy || undefined}
        className={classes}
        {...rest}
      >
        {content}
      </button>
    );
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      className={classes}
      whileHover={isDisabled ? undefined : motionButtonHover}
      whileTap={isDisabled ? undefined : motionButtonTap}
      transition={motionButtonTransition}
      {...rest}
    >
      {content}
    </motion.button>
  );
});

export default MotionButton;
