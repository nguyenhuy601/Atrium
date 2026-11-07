/**
 * Shared Project workspace visual classes (List baseline → 3 shells).
 * Prefer semantic tokens; avoid slate-* / hardcoded hex in new chrome.
 */

export const HUB_TITLE = 'text-sm font-bold tracking-tight text-foreground';
export const HUB_MUTED = 'text-xs text-muted-foreground';
export const HUB_HINT = 'mt-0.5 max-w-xl text-xs text-muted-foreground';

export const HUB_PANEL = 'flex min-h-0 flex-1 flex-col overflow-hidden bg-surface';
export const HUB_PANEL_PAD = 'px-4 py-4 sm:px-5';

export const HUB_HEADER =
  'shrink-0 border-b border-border bg-surface';
export const HUB_HEADER_ROW =
  'flex min-w-0 flex-col gap-2 px-3 pt-2.5 pb-2 sm:flex-row sm:items-center sm:gap-2.5 sm:px-4';

export const HUB_ICON_BTN =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-auto sm:w-auto';

export const HUB_BADGE_CODE =
  'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold bg-primary/10 text-primary';
export const HUB_BADGE_META =
  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground';
export const HUB_BADGE_PHASE =
  'shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary';

export const HUB_TAB_ACTIVE =
  'min-h-11 shrink-0 whitespace-nowrap border-b-2 border-primary px-3 py-2 text-[11px] font-semibold text-primary transition-colors';
export const HUB_TAB_IDLE =
  'min-h-11 shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground';
export const HUB_TAB_DISABLED =
  'min-h-11 shrink-0 cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[11px] font-semibold text-muted-foreground/40';

export const HUB_CONTROL_BTN =
  'rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export const HUB_EMPTY =
  'rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground';

export const HUB_SECTION_SHELL =
  'overflow-hidden rounded-xl border border-border bg-surface shadow-sm';
export const HUB_SECTION_HEAD =
  'border-b border-border bg-muted/60 px-3.5 py-2.5';

/** Dense table — align Phase1 lists to List/Atrium tokens */
export const HUB_TABLE_FRAME =
  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm';
export const HUB_TABLE_SHELL =
  'min-h-0 flex-1 overflow-auto rounded-t-lg bg-surface [scrollbar-gutter:stable]';
export const HUB_TH =
  'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground';
export const HUB_TD =
  'border-b border-border px-3 py-2.5 align-top text-[13px] leading-snug text-foreground';
export const HUB_ROW =
  'cursor-pointer transition-colors odd:bg-surface even:bg-muted/30 hover:bg-primary/5';
export const HUB_ROW_SELECTED =
  'bg-primary/10 hover:bg-primary/15 ring-1 ring-inset ring-primary/30 odd:bg-primary/10 even:bg-primary/10';
export const HUB_ROW_EDITING =
  'bg-amber-500/10 hover:bg-amber-500/15 ring-1 ring-inset ring-amber-500/40 odd:bg-amber-500/10 even:bg-amber-500/10';

export const HUB_PRIMARY_BTN =
  'inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
export const HUB_SECONDARY_BTN =
  'inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

/** Timeline chrome — denser AdminKit-style strip */
export const HUB_TL_TOOLBAR =
  'flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/70 px-2.5 py-1.5 sm:px-3';
export const HUB_TL_SEARCH =
  'h-7 w-full max-w-[14rem] rounded-md border-0 bg-surface py-1 pl-7 pr-2 text-[11px] text-foreground shadow-sm ring-1 ring-border transition-colors motion-reduce:transition-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export const HUB_TL_SELECT =
  'h-7 max-w-[9rem] truncate rounded-md border-0 bg-surface px-2 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export const HUB_TL_ICON_BTN =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-muted-foreground shadow-sm ring-1 ring-border transition-colors motion-reduce:transition-none hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';
export const HUB_TL_LEGEND_CHIP =
  'inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm ring-1 ring-border';
export const HUB_TL_WORK_HEAD =
  'flex shrink-0 items-center border-b border-border bg-muted px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground';
export const HUB_TL_GANTT_HEAD =
  'sticky top-0 z-20 touch-none select-none border-b border-border bg-muted shadow-sm';
