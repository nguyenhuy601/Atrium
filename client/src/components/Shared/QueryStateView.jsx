import { AdminLoadErrorState } from '../adminUsers/adminPanelStates';
import { useAppStrings } from '../../locales/appStrings';

/**
 * loading | error+retry (when empty) | empty | children
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
  loadingClassName = 'py-16 text-center text-sm text-muted-foreground',
  errorClassName = 'px-6 py-8',
}) {
  const { t } = useAppStrings();

  if (loading) {
    return (
      <div className={loadingClassName} role="status" aria-live="polite">
        {t('common.loadingEllipsis')}
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

  return children;
}
