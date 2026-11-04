import { createPortal } from 'react-dom';
import useMotionPresence from '../../../../motion/useMotionPresence';
import { VH_MOTION_OVERLAY_MS } from '../../../../motion/tokens';
import MonitorRunLoadingCard from './MonitorRunLoadingCard';

/**
 * Blocking progress while WHAT/HOW AI run is in-flight.
 * Same z-band as GateActionOverlay (under note dialogs ~10050).
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
  const { mounted, phase } = useMotionPresence(Boolean(open), {
    durationMs: VH_MOTION_OVERLAY_MS,
  });

  if (!mounted || typeof document === 'undefined') return null;

  const ariaLabel = String(heroText || phaseLabel || '').trim() || 'AI';

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 vh-presence-overlay vh-motion-respect"
      data-motion-phase={phase || 'enter'}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm vh-presence-backdrop"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg vh-presence-panel">
        <MonitorRunLoadingCard
          phaseLabel={phaseLabel}
          done={done}
          total={total}
          heroText={heroText}
          showSpinner={showSpinner}
          t={t}
          variant="overlay"
        />
      </div>
    </div>,
    document.body
  );
}
