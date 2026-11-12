import { useEffect, useId, useRef } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { VH_MOTION_BTN, VH_MOTION_ROW } from '../../motion/classes';
import MotionMenu from '../../motion/primitives/MotionMenu';
import {
  ADMIN_CONTROL_RADIUS_CLASS,
  ADMIN_LIST_PAGE_SIZE,
  ADMIN_LIST_PAGE_SIZE_OPTIONS,
} from '../../config/adminSuiteTokens';

export { ADMIN_LIST_PAGE_SIZE, ADMIN_LIST_PAGE_SIZE_OPTIONS };

const ADMIN_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--admin-control-focus,var(--ring))]';

/**
 * Khung bảng/list admin dày — scroll trong card (sticky thead bên trong children).
 */
export function AdminDenseTableCard({ children, className = '' }) {
  return (
    <div
      className={`flex max-h-[calc(100dvh-12rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** Vùng cuộn dọc (+ ngang nếu bảng rộng) trong AdminDenseTableCard. */
export function AdminDenseTableScroll({ children, className = '', ...rest }) {
  return (
    <div {...rest} className={`min-h-0 flex-1 overflow-auto ${className}`.trim()}>
      {children}
    </div>
  );
}

const PILL_VARIANT = {
  success: 'bg-success-bg text-success ring-1 ring-success/40',
  warning: 'bg-warning-bg text-warning ring-1 ring-warning/40',
  error: 'bg-error-bg text-destructive ring-1 ring-destructive/40',
  info: 'bg-info-bg text-info ring-1 ring-info/40',
  muted: 'bg-muted text-muted-foreground ring-1 ring-border',
  primary: 'bg-primary-subtle text-primary ring-1 ring-border',
};

/** Badge trạng thái admin — variant thống nhất users/accounts. */
export function AdminPillBadge({ children, variant = 'muted', className = '', title }) {
  const tone = PILL_VARIANT[variant] || PILL_VARIANT.muted;
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

/**
 * Danh sách thẻ thay bảng dày trên màn hẹp (< md).
 * Layout cố định: title · meta · badge hàng · actions phải.
 */
export function AdminDenseMobileList({
  items = [],
  getKey,
  renderTitle,
  renderMeta,
  renderBadge,
  renderActions,
  onSelect,
  selectedKey,
  ariaLabel,
}) {
  return (
    <ul className="space-y-2 p-3 md:hidden" aria-label={ariaLabel}>
      {items.map((item) => {
        const key = getKey(item);
        const isSelected = selectedKey != null && String(selectedKey) === String(key);
        return (
          <li
            key={key}
            className={`rounded-lg border bg-card p-3 ${VH_MOTION_ROW} ${
              isSelected ? 'border-primary shadow-sm' : 'border-border'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    aria-pressed={selectedKey !== undefined ? isSelected : undefined}
                    className={`block w-full min-w-0 rounded-md text-left ${ADMIN_FOCUS}`}
                  >
                    <div className="truncate text-sm font-medium text-foreground">{renderTitle(item)}</div>
                    {renderMeta ? (
                      <div className="mt-1 text-xs text-muted-foreground">{renderMeta(item)}</div>
                    ) : null}
                  </button>
                ) : (
                  <>
                    <div className="truncate text-sm font-medium text-foreground">{renderTitle(item)}</div>
                    {renderMeta ? (
                      <div className="mt-1 text-xs text-muted-foreground">{renderMeta(item)}</div>
                    ) : null}
                  </>
                )}
                {renderBadge ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">{renderBadge(item)}</div>
                ) : null}
              </div>
              {renderActions ? (
                <div className="flex shrink-0 items-start justify-end pt-0.5">{renderActions(item)}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Shell + form card dùng chung cho các màn admin Users (enterprise).
 */
export function AdminUserPanelShell({ title, hint, actions, children, wide = false, fillHeight = false }) {
  return (
    <div
      className={`mx-auto flex w-full flex-col ${fillHeight ? 'min-h-0 flex-1' : ''} ${
        wide ? 'max-w-[1400px]' : 'max-w-5xl'
      } ${fillHeight ? 'gap-4' : 'space-y-5'}`}
    >
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className={fillHeight ? 'min-h-0 flex-1' : undefined}>{children}</div>
    </div>
  );
}

/** Màu lấy từ token theo theme; caller cũ vẫn truyền `isDarkMode` (bỏ qua). */
export function AdminUserFormCard({ title, hint, children, danger = false }) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 shadow-sm ${danger ? 'border-destructive' : 'border-border'}`}
    >
      {title ? <h3 className="text-base font-semibold text-foreground">{title}</h3> : null}
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className={title || hint ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}

const ADMIN_BTN_BASE = `inline-flex items-center justify-center gap-2 ${ADMIN_CONTROL_RADIUS_CLASS} px-4 py-2.5 text-sm ${ADMIN_FOCUS} disabled:cursor-not-allowed disabled:opacity-50 ${VH_MOTION_BTN}`;

export function adminPrimaryBtnClass(extra = '') {
  return `${ADMIN_BTN_BASE} bg-primary font-semibold text-primary-foreground shadow-sm hover:brightness-110 ${extra}`;
}

/** Tham số thứ hai (`isDarkMode`) giữ cho caller cũ, không còn dùng. */
export function adminSecondaryBtnClass(extra = '') {
  return `${ADMIN_BTN_BASE} border border-border bg-card font-medium text-foreground shadow-sm hover:bg-muted ${extra}`;
}

export function adminDangerBtnClass(extra = '') {
  return `${ADMIN_BTN_BASE} border border-destructive bg-card font-semibold text-destructive hover:bg-muted ${extra}`;
}

export function adminInputClass(extra = '') {
  return `w-full ${ADMIN_CONTROL_RADIUS_CLASS} border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-[var(--vh-motion-base)] ease-[var(--vh-motion-ease)] motion-reduce:transition-none focus:ring-2 focus:ring-[color:var(--admin-control-focus,var(--ring))] ${ADMIN_FOCUS} ${extra}`;
}

/** List/table row — hover bg via Enterprise Motion SoT. */
export function adminHoverRowClass(extra = '') {
  return `hover:bg-muted ${VH_MOTION_ROW} ${extra}`.trim();
}

/** Filter select / compact toolbar control. */
export function adminFilterSelectClass(extra = '') {
  return `w-full ${ADMIN_CONTROL_RADIUS_CLASS} border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-[var(--vh-motion-base)] ease-[var(--vh-motion-ease)] motion-reduce:transition-none ${ADMIN_FOCUS} ${extra}`.trim();
}

/** Pager / icon toolbar button. */
export function adminListIconBtnClass(extra = '') {
  return `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground ${ADMIN_FOCUS} disabled:cursor-not-allowed disabled:opacity-50 ${VH_MOTION_BTN} ${extra}`.trim();
}

/** xs bordered action (matrix, boards, voice admin). */
export function adminCompactBtnClass(extra = '') {
  return `rounded border border-border px-2 py-0.5 text-xs hover:bg-muted ${ADMIN_FOCUS} ${VH_MOTION_BTN} ${extra}`.trim();
}

export function adminLabelClass() {
  return 'mb-1.5 block text-xs font-medium text-muted-foreground';
}

/** Wave 1 PD — primary Manage deep-link (micro-motion + reduced-motion). */
export function adminManageLinkClass(extra = '') {
  return `inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-muted ${ADMIN_FOCUS} ${VH_MOTION_BTN} ${extra}`.trim();
}

/** Dense table row hover — Enterprise Motion SoT. */
export function adminDenseRowClass(extra = '') {
  return `border-b border-border ${VH_MOTION_ROW} ${extra}`.trim();
}

/**
 * Filter popover tái dùng — MotionMenu + badge count + clear.
 */
export function AdminListFilterPopover({
  open,
  onOpenChange,
  activeCount = 0,
  label,
  activeTitle,
  clearLabel,
  onClear,
  menuKey = 'admin-list-filters',
  children,
}) {
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        onOpenChange(false);
      }
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      onOpenChange(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className={adminSecondaryBtnClass('px-3 py-2.5 active:bg-muted')}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {label}
        {activeCount ? (
          <span
            className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
            title={activeTitle}
          >
            {activeCount}
          </span>
        ) : null}
      </button>
      <MotionMenu
        open={open}
        menuKey={menuKey}
        role="dialog"
        id={panelId}
        aria-label={label}
        className="absolute right-0 z-20 mt-2 w-[min(calc(100vw-2rem),20rem)] space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg"
      >
        {children}
        {activeCount && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className={adminHoverRowClass(
              `w-full ${ADMIN_CONTROL_RADIUS_CLASS} px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground ${ADMIN_FOCUS}`
            )}
          >
            {clearLabel}
          </button>
        ) : null}
      </MotionMenu>
    </div>
  );
}

/**
 * Pagination sticky footer — prev/next + page size + label.
 */
export function AdminListPagination({
  page,
  totalPages,
  pageSize = ADMIN_LIST_PAGE_SIZE,
  pageSizeOptions = ADMIN_LIST_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  labels,
}) {
  const {
    prev = 'Prev',
    next = 'Next',
    pageLabel,
    pageSizeAria = 'Rows per page',
  } = labels || {};

  return (
    <div className="sticky bottom-0 z-[1] flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange?.(Math.max(1, page - 1))}
        className={adminListIconBtnClass()}
        aria-label={prev}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        {prev}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {pageLabel || `${page}/${totalPages}`}
        </span>
        {onPageSizeChange ? (
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="sr-only">{pageSizeAria}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value) || ADMIN_LIST_PAGE_SIZE)}
              aria-label={pageSizeAria}
              className={`${ADMIN_CONTROL_RADIUS_CLASS} border border-border bg-background px-2 py-1 text-xs ${ADMIN_FOCUS}`}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
        className={adminListIconBtnClass()}
        aria-label={next}
      >
        {next}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Search field chuẩn toolbar admin list. */
export function AdminListSearchInput({ value, onChange, placeholder, ariaLabel, className = '' }) {
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      maxLength={120}
      className={`${adminFilterSelectClass()} py-2.5 pl-9 pr-3 ${className}`.trim()}
    />
  );
}
