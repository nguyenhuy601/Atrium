import { useEffect, useState } from 'react';

/**
 * Khóa scroll body khi overlay mở; giữ lock đến khi exit Motion xong.
 * Gọi `release()` từ `MotionPresence` onExitComplete.
 *
 * setLocked trì hoãn 1 frame khi mở — tránh re-render đồng bộ cắt enter Motion.
 */
export default function useOverlayScrollLock(isOpen) {
  const [locked, setLocked] = useState(Boolean(isOpen));

  useEffect(() => {
    if (!isOpen) return undefined;
    let raf = requestAnimationFrame(() => setLocked(true));
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!locked || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  return {
    locked,
    release: () => setLocked(false),
  };
}
