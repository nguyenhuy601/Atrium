/**
 * SoT accent / radius / focus cho suite Quản trị (`/manage`) và Admin (`/admin`).
 * Content CTA vẫn dùng `--primary`; chrome sidebar/header đồng bộ accent này.
 */
export const ADMIN_SUITE_ACCENT = '#2563EB';
export const ADMIN_SUITE_ACCENT_HOVER = '#1D4ED8';
export const ADMIN_SUITE_ACCENT_SOFT = 'rgba(37, 99, 235, 0.14)';
export const ADMIN_SUITE_ACCENT_BORDER = 'rgba(37, 99, 235, 0.35)';
export const ADMIN_SUITE_ACCENT_GLOW = 'rgba(37, 99, 235, 0.12)';

/** Alias tương thích import cũ từ adminDomainsConfig. */
export const ADMIN_SUITE_COLOR = ADMIN_SUITE_ACCENT;

/** Page size mặc định + options pager admin lists. */
export const ADMIN_LIST_PAGE_SIZE = 10;
export const ADMIN_LIST_PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50]);

/** Class radius control admin — khớp `--admin-control-radius` / `--radius-md`. */
export const ADMIN_CONTROL_RADIUS_CLASS = 'rounded-[var(--admin-control-radius,var(--radius-md))]';

export function adminSuiteAccentVars(accent = ADMIN_SUITE_ACCENT) {
  return {
    '--admin-suite-accent': accent,
    '--admin-suite-accent-hover': ADMIN_SUITE_ACCENT_HOVER,
    '--admin-suite-accent-soft': ADMIN_SUITE_ACCENT_SOFT,
    '--admin-suite-accent-border': ADMIN_SUITE_ACCENT_BORDER,
  };
}
