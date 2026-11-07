import { VH_MOTION_SPINNER } from '../classes.js';

/**
 * Spinner inline (button / fetch cell). Tôn trọng reduced-motion.
 */
export default function InlineBusy({ className = '', label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent ${VH_MOTION_SPINNER} ${className}`.trim()}
    />
  );
}
