import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useAppStrings } from '../../locales/appStrings';
import MotionPresence from '../../motion/primitives/MotionPresence';
import {
  motionBackdrop,
  motionModalPanel,
  motionOverlayShell,
} from '../../motion/overlayMotion';
import useOverlayScrollLock from '../../motion/useOverlayScrollLock';
import useModalA11y from './useModalA11y';
import {
  FIGMA_MODAL_BACKDROP,
  FIGMA_MODAL_BODY,
  FIGMA_MODAL_CLOSE_BTN,
  FIGMA_MODAL_HEADER,
  FIGMA_MODAL_OVERLAY,
  FIGMA_MODAL_PANEL,
  FIGMA_MODAL_SIZES,
  FIGMA_MODAL_TITLE,
} from './figmaSharedClasses';

const DEFAULT_MODAL_Z = 10050;

/**
 * Merge overlay tokens with optional layerClassName.
 * Legacy low z-* overrides (e.g. z-[250]) are ignored so shell nav (z-1200) stays below.
 * High overrides (Profile z-[99999]) replace the default z.
 */
function resolveOverlayClass(layerClassName = '') {
  const extra = String(layerClassName || '').trim();
  const zMatch = extra.match(/\bz-\[(\d+)\]/);
  if (!zMatch) {
    return `${FIGMA_MODAL_OVERLAY} ${extra}`.trim();
  }
  const z = Number(zMatch[1]);
  if (Number.isFinite(z) && z >= DEFAULT_MODAL_Z) {
    const base = FIGMA_MODAL_OVERLAY.replace(/\bz-\[\d+\]/, '').trim();
    return `${base} ${extra}`.trim();
  }
  const withoutZ = extra.replace(/\bz-\[\d+\]/g, '').trim();
  return `${FIGMA_MODAL_OVERLAY} ${withoutZ}`.trim();
}

/**
 * Shared modal — portal + Motion enter/exit. A11y theo logical isOpen.
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  layerClassName = '',
  closable = true,
  fill = false,
  footer = null,
  bodyClassName = '',
  panelClassName = '',
  headerClassName = '',
  titleClassName = '',
}) => {
  const { t } = useAppStrings();
  const panelRef = useRef(null);
  const titleId = useId();
  const { release } = useOverlayScrollLock(isOpen);

  useModalA11y({
    isOpen,
    onClose,
    containerRef: panelRef,
    initialFocusRef: panelRef,
    isBusy: !closable,
  });

  if (typeof document === 'undefined') return null;

  const sizeClass = fill
    ? FIGMA_MODAL_SIZES.full
    : FIGMA_MODAL_SIZES[size] || FIGMA_MODAL_SIZES.md;
  const panelClass = fill
    ? `${FIGMA_MODAL_PANEL} ${sizeClass} h-[min(95dvh,95vh)] max-h-[min(95dvh,95vh)] ${panelClassName}`.trim()
    : `${FIGMA_MODAL_PANEL} ${sizeClass} ${panelClassName}`.trim();
  const bodyClass = fill
    ? `flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3 ${bodyClassName}`.trim()
    : `${FIGMA_MODAL_BODY} ${bodyClassName}`.trim();
  const overlayClass = resolveOverlayClass(layerClassName);
  const headerClass = `${FIGMA_MODAL_HEADER} ${headerClassName}`.trim();
  const titleClass = `${FIGMA_MODAL_TITLE} ${titleClassName}`.trim();
  const canDismiss = closable && isOpen;

  return createPortal(
    <MotionPresence open={isOpen} initial onExitComplete={release}>
      <motion.div
        key="vh-modal"
        className={`${overlayClass} vh-motion-respect`}
        {...motionOverlayShell}
        onClick={canDismiss ? onClose : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <motion.div className={FIGMA_MODAL_BACKDROP} aria-hidden {...motionBackdrop} />
        <motion.div
          ref={panelRef}
          tabIndex={-1}
          className={`${panelClass} origin-center outline-none`}
          onClick={(e) => e.stopPropagation()}
          {...motionModalPanel}
        >
          <div className={headerClass}>
            <h2 id={titleId} className={titleClass}>
              {title}
            </h2>
            {closable ? (
              <button
                type="button"
                onClick={onClose}
                className={FIGMA_MODAL_CLOSE_BTN}
                aria-label={t('common.close')}
                disabled={!isOpen}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <span className="h-8 w-8 shrink-0" aria-hidden />
            )}
          </div>
          <div className={bodyClass}>{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-border px-3 py-2.5 sm:px-4 sm:py-3">
              {footer}
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </MotionPresence>,
    document.body
  );
};

export default Modal;
