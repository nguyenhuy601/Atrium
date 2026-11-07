/**
 * Tabler-inspired chrome for hub dashboards (overview + closure report).
 * Design-system tokens only — no raw brand hex.
 */

export const REPORT_PAGE =
  'scrollbar-overlay mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-y-auto bg-muted/40 p-3 sm:gap-5 sm:p-4 lg:p-6';

/** White panel — 1px border, modest radius (Tabler card). */
export const REPORT_CARD =
  'rounded-lg border border-border bg-card shadow-none';

export const REPORT_CARD_PAD = `${REPORT_CARD} p-4 sm:p-5`;

export const REPORT_CARD_HEAD =
  'mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3';

export const REPORT_CARD_TITLE =
  'text-sm font-semibold tracking-tight text-foreground';

export const REPORT_EYEBROW =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

export const REPORT_BTN_SECONDARY =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';

export const REPORT_BTN_PRIMARY =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const REPORT_SELECT =
  'h-9 min-w-[9.5rem] max-w-full rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[11rem]';
