import { VH_MOTION_SKELETON } from '../classes.js';

/**
 * Block skeleton SoT — dùng khi loading/fetch empty state.
 */
export default function SkeletonBlock({ className = '', lines = 0, ...rest }) {
  if (lines > 0) {
    return (
      <div className={`space-y-2 ${className}`.trim()} aria-hidden {...rest}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className={`${VH_MOTION_SKELETON} h-3 rounded-md ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`${VH_MOTION_SKELETON} ${className}`.trim()} aria-hidden {...rest} />;
}
