import { AnimatePresence, motion } from 'motion/react';
import { AdminLoadErrorState } from '../adminUsers/adminPanelStates';
import { useAppStrings } from '../../locales/appStrings';
import SkeletonBlock from '../../motion/primitives/SkeletonBlock';
import { motionTransitionBase } from '../../motion/transitions';

/**
 * loading | error+retry (when empty) | empty | children
 * loading: skeleton SoT; children: fade enter ngắn.
 */
export default function QueryStateView({
  loading = false,
  error = false,
  errorMessage = '',
  onRetry,
  retryDisabled = false,
  isEmpty = false,
  empty = null,
  children,
  loadingClassName = 'space-y-3 py-10',
  errorClassName = 'px-6 py-8',
  /** Class cho khung content (ready) — dùng khi parent flex cần min-h-0/flex-1. */
  contentClassName = '',
  skeletonLines = 4,
}) {
  const { t } = useAppStrings();

  if (loading) {
    return (
      <div className={loadingClassName} role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t('common.loadingEllipsis')}</span>
        <SkeletonBlock lines={skeletonLines} />
      </div>
    );
  }

  if (error && isEmpty) {
    return (
      <AdminLoadErrorState
        className={errorClassName}
        message={errorMessage || t('common.error')}
        onRetry={onRetry}
        disabled={retryDisabled}
      />
    );
  }

  if (isEmpty && empty) {
    return empty;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key="query-ready"
        className={`vh-motion-respect ${contentClassName}`.trim()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={motionTransitionBase}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
