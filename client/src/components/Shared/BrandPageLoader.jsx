import { Zap } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ShellWaveBackdrop from '../Layout/ShellWaveBackdrop';
import { appShellBg } from '../../theme/shellTheme';
import { useAppStrings } from '../../locales/appStrings';
import { VH_MOTION_SPINNER } from '../../motion/classes';
import MotionStagger from '../../motion/primitives/MotionStagger';
import FetchBar from '../../motion/primitives/FetchBar';
import PageLoaderBar from '../../motion/primitives/PageLoaderBar';

/**
 * Màn chờ toàn trang — Suspense / ProtectedRoute / HMR remount.
 * Brand-first + MotionStagger; FetchBar + PageLoaderBar (SoT motion).
 */
export default function BrandPageLoader({
  message,
  subMessage,
  className = '',
  /** false khi embed preview (Motion Lab) — tránh FetchBar fixed phủ cả app. */
  showFetchBar = true,
}) {
  const { isDarkMode } = useTheme();
  const { t } = useAppStrings();
  const messageText = message || t('common.loadingEllipsis');
  const subMessageText = subMessage || t('common.pleaseWaitMoment');
  const titleCls = isDarkMode ? 'text-white' : 'text-foreground';
  const mutedCls = isDarkMode ? 'text-slate-400' : 'text-muted-foreground';

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden ${appShellBg(isDarkMode)} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="brand-page-loader"
    >
      {showFetchBar ? <FetchBar active /> : null}
      <ShellWaveBackdrop />

      <div className="relative z-10 w-full max-w-sm px-6">
        <MotionStagger className="flex flex-col items-center text-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-[0_8px_28px_-6px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
              aria-hidden
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/25 blur-md"
                aria-hidden
              />
              <Zap
                size={26}
                className="relative fill-primary-foreground text-primary-foreground"
                strokeWidth={2}
              />
            </div>
            <p className={`font-display text-2xl font-bold tracking-tight ${titleCls}`}>
              Atrium
            </p>
          </div>

          <div className="mt-8 flex w-full flex-col items-center gap-4">
            <div
              className={`h-9 w-9 rounded-full border-2 border-primary/20 border-t-primary ${VH_MOTION_SPINNER}`}
              aria-hidden
            />
            <PageLoaderBar label={messageText} />
          </div>

          <div className="mt-6 space-y-1.5">
            <p className={`text-base font-semibold tracking-tight ${titleCls}`}>{messageText}</p>
            <p className={`text-sm leading-relaxed ${mutedCls}`}>{subMessageText}</p>
          </div>
        </MotionStagger>
      </div>
    </div>
  );
}
