import { AnimatePresence } from 'motion/react';

/**
 * Wrapper AnimatePresence SoT — `open` điều khiển mount/exit.
 * Feature không import AnimatePresence trực tiếp.
 *
 * `initial` mặc định `true`: overlay/dropdown thường mount khi `open=false`,
 * lần mở đầu phải chạy enter (opacity/scale/y). `initial={false}` chỉ dùng khi
 * surface đã visible lúc mount và không muốn flash enter.
 */
export default function MotionPresence({
  open,
  children,
  mode = 'sync',
  initial = true,
  onExitComplete,
}) {
  return (
    <AnimatePresence mode={mode} initial={initial} onExitComplete={onExitComplete}>
      {open ? children : null}
    </AnimatePresence>
  );
}
