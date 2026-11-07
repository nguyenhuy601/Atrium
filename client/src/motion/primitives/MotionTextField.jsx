import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { motion } from 'motion/react';
import { VH_MOTION_FIELD } from '../classes.js';
import { gsapFieldInvalidPulse } from '../gsapSetup.js';
import { motionFieldFocus, motionTransitionBase } from '../transitions.js';

/**
 * Text input enterprise — CSS focus ring + Motion focus lift + GSAP invalid pulse.
 */
const MotionTextField = forwardRef(function MotionTextField(
  {
    className = '',
    invalid = false,
    disableMotion = false,
    onInvalidPulse,
    ...rest
  },
  ref
) {
  const localRef = useRef(null);
  useImperativeHandle(ref, () => localRef.current);

  useEffect(() => {
    if (!invalid || disableMotion) return undefined;
    const tween = gsapFieldInvalidPulse(localRef.current);
    onInvalidPulse?.(tween);
    return () => {
      tween?.kill?.();
    };
  }, [invalid, disableMotion, onInvalidPulse]);

  const classes = `${VH_MOTION_FIELD} ${className}`.trim();

  if (disableMotion) {
    return <input ref={localRef} className={classes} aria-invalid={invalid ? 'true' : undefined} {...rest} />;
  }

  return (
    <motion.input
      ref={localRef}
      className={classes}
      aria-invalid={invalid ? 'true' : undefined}
      whileFocus={motionFieldFocus}
      transition={motionTransitionBase}
      {...rest}
    />
  );
});

export default MotionTextField;
