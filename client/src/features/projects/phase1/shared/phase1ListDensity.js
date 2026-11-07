/** Dense list — Atrium semantic tokens (đồng bộ List / projectHubUiClasses). */

import {
  HUB_ROW,
  HUB_ROW_EDITING,
  HUB_ROW_SELECTED,
  HUB_TABLE_FRAME,
  HUB_TABLE_SHELL,
  HUB_TD,
  HUB_TH,
} from '../../hub/projectHubUiClasses';

export const PHASE1_DENSE_ROW = HUB_ROW;

export const PHASE1_DENSE_CELL =
  'px-3 py-2.5 text-[13px] leading-snug text-foreground';

export const PHASE1_DENSE_HEAD =
  'px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground';

export const PHASE1_DENSE_ROW_SELECTED = HUB_ROW_SELECTED;

/** Row currently open in edit popup */
export const PHASE1_DENSE_ROW_EDITING = HUB_ROW_EDITING;

export const PHASE1_TABLE = 'w-full min-w-max border-collapse text-left';

export const PHASE1_TH = `${HUB_TH}`;

export const PHASE1_TH_STICKY = `${PHASE1_TH} sticky left-0 z-20 shadow-[2px_0_0_0_hsl(var(--border))]`;

export const PHASE1_TD = `${HUB_TD}`;

export const PHASE1_TD_STICKY = `${PHASE1_TD} sticky left-0 z-[1] bg-inherit shadow-[2px_0_0_0_hsl(var(--border))]`;

export const PHASE1_TABLE_SHELL = HUB_TABLE_SHELL;

export const PHASE1_TABLE_FRAME = HUB_TABLE_FRAME;
