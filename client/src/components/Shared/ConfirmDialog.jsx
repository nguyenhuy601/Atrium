import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import MotionPresence from '../../motion/primitives/MotionPresence';
import { motionBackdrop, motionModalPanel } from '../../motion/overlayMotion';
import useOverlayScrollLock from '../../motion/useOverlayScrollLock';
import useModalA11y from './useModalA11y';

const DANGER_CONFIRM_CLASS =
  'bg-destructive text-destructive-foreground vh-motion-btn hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:transform-none';

const DEFAULT_CONFIRM_CLASS =
  'bg-primary text-primary-foreground shadow-sm vh-motion-btn hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:transform-none';

const CANCEL_BTN_CLASS =
  'border border-border bg-background px-4 py-3 font-semibold text-foreground vh-motion-btn hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  layerClassName = 'z-[10050]',
}) => {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const { release } = useOverlayScrollLock(isOpen);
  const showCancel = Boolean(cancelText);

  useModalA11y({
    isOpen,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: showCancel ? cancelRef : confirmRef,
    isBusy: pending,
  });

  useEffect(() => {
    if (!isOpen) {
      pendingRef.current = false;
      setPending(false);
    }
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  const handleConfirm = () => {
    if (pendingRef.current || !isOpen) return;
    pendingRef.current = true;
    setPending(true);
    let ret;
    try {
      ret = onConfirm?.();
    } catch (error) {
      ret = Promise.reject(error);
    }
    Promise.resolve(ret)
      .catch(() => {})
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
        onClose();
      });
  };

  const handleBackdropClick = () => {
    if (!pendingRef.current && isOpen) onClose();
  };

  const isDanger = variant === 'danger';
  const shell = `border bg-card shadow-2xl ${isDanger ? 'border-destructive' : 'border-border'}`;
  const confirmBtn = isDanger ? DANGER_CONFIRM_CLASS : DEFAULT_CONFIRM_CLASS;

  return createPortal(
    <MotionPresence open={isOpen} onExitComplete={release}>
      <motion.div
        key="vh-confirm"
        className={`fixed inset-0 ${layerClassName} flex items-center justify-center p-4 vh-motion-respect`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        role="presentation"
      >
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          aria-hidden
          {...motionBackdrop}
        />
        <motion.div
          ref={dialogRef}
          className={`relative max-w-md w-full rounded-2xl backdrop-blur-md ${shell}`}
          onClick={(e) => e.stopPropagation()}
          role={isDanger ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          aria-busy={pending || undefined}
          {...motionModalPanel}
        >
          <div className="p-6">
            <h3 id={titleId} className="mb-3 text-xl font-bold text-foreground">
              {title}
            </h3>
            <p id={messageId} className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {message}
            </p>
            <div className="flex gap-3">
              {showCancel ? (
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onClose}
                  disabled={pending || !isOpen}
                  className={`flex-1 rounded-xl disabled:cursor-not-allowed disabled:opacity-60 ${CANCEL_BTN_CLASS}`}
                >
                  {cancelText}
                </button>
              ) : null}
              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirm}
                disabled={pending || !isOpen}
                className={`flex-1 rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed ${confirmBtn}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </MotionPresence>,
    document.body
  );
};

export default ConfirmDialog;
