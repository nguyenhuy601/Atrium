import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import MotionPresence from '../../../motion/primitives/MotionPresence';
import {
  motionBackdrop,
  motionModalPanel,
  motionOverlayShell,
} from '../../../motion/overlayMotion';
import useOverlayScrollLock from '../../../motion/useOverlayScrollLock';
import { VH_MOTION_BTN } from '../../../motion/classes';

/**
 * Overlay popover cho một nhóm Settings — Esc + click ngoài để đóng.
 */
export default function ProjectHubSettingsPopover({
  isOpen,
  title,
  onClose,
  footer = null,
  children,
  t,
}) {
  const panelRef = useRef(null);
  const open = Boolean(isOpen);
  const { release } = useOverlayScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <MotionPresence open={open} onExitComplete={release}>
      <motion.div
        key="project-hub-settings-popover"
        className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4 vh-motion-respect"
        {...motionOverlayShell}
      >
        <motion.div
          className="absolute inset-0 bg-background/70 backdrop-blur-[2px]"
          aria-hidden
          {...motionBackdrop}
        />
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-2xl origin-center flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-xl sm:max-h-[min(85vh,36rem)] sm:rounded-2xl"
          {...motionModalPanel}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h4 className="truncate text-sm font-bold text-foreground">{title}</h4>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VH_MOTION_BTN}`}
              aria-label={t('workspace.projectHubSettingsClose')}
            >
              <X size={16} />
            </button>
          </header>
          <div className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 text-foreground">
            {children}
          </div>
          {footer ? (
            <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              {footer}
            </footer>
          ) : null}
        </motion.div>
      </motion.div>
    </MotionPresence>,
    document.body
  );
}
