import { motion } from 'motion/react';
import { useAppStrings } from '../../locales/appStrings';
import { motionToast } from '../../motion/overlayMotion';
import {
  FIGMA_TOAST_ERROR,
  FIGMA_TOAST_INFO,
  FIGMA_TOAST_ROOT,
  FIGMA_TOAST_SUCCESS,
} from './figmaSharedClasses';

/**
 * Thông báo nổi góc màn hình — Motion enter/exit (SoT overlay).
 */
function Toast({ message, type = 'success', onClose }) {
  const { t } = useAppStrings();
  const isError = type === 'error' || type === 'fail';
  const tone = isError
    ? FIGMA_TOAST_ERROR
    : type === 'info'
      ? FIGMA_TOAST_INFO
      : FIGMA_TOAST_SUCCESS;

  return (
    <motion.div
      className={`${FIGMA_TOAST_ROOT} ${tone}`}
      role="status"
      {...motionToast}
    >
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-muted-foreground vh-motion-btn hover:bg-muted hover:text-foreground motion-reduce:transform-none"
          aria-label={t('common.close')}
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}

export default Toast;
