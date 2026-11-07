import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import MotionPresence from '../../../../motion/primitives/MotionPresence';
import { motionBackdrop, motionModalPanel } from '../../../../motion/overlayMotion';
import useOverlayScrollLock from '../../../../motion/useOverlayScrollLock';
import MonitorRunLoadingCard from './MonitorRunLoadingCard';

/**
 * Blocking progress while WHAT/HOW AI run is in-flight.
 * Portal + Motion enter/exit — z-[10050] above shell nav rail.
 */
export default function AiRunProgressOverlay({
  open,
  phaseLabel,
  done = 0,
  total = 0,
  heroText,
  showSpinner = true,
  t,
}) {
  const isOpen = Boolean(open);
  const { release } = useOverlayScrollLock(isOpen);

  if (typeof document === 'undefined') return null;

  const ariaLabel = String(heroText || phaseLabel || '').trim() || 'AI';

  return createPortal(
    <MotionPresence open={isOpen} onExitComplete={release}>
      <motion.div
        key="ai-run-progress"
        className="fixed inset-0 z-[10050] flex items-center justify-center p-4 vh-motion-respect"
        data-testid="ai-run-progress-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        aria-live="polite"
        aria-label={ariaLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          aria-hidden
          {...motionBackdrop}
        />
        <motion.div
          className="relative mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg"
          {...motionModalPanel}
        >
          <MonitorRunLoadingCard
            phaseLabel={phaseLabel}
            done={done}
            total={total}
            heroText={heroText}
            showSpinner={showSpinner}
            t={t}
            variant="overlay"
          />
        </motion.div>
      </motion.div>
    </MotionPresence>,
    document.body
  );
}
