# Motion inventory — Projects suite (`/projects/:id/*`)

Status: **Wave P1–P4** — Collab (chat/calendar/documents) + Ops (members/activity/settings/reports) motion SoT applied in hub modules.

Audit URL (Playwright, 2026-11-07): `https://atrium.dev/projects/6adf3610599dba0fefb438a6/overview`

## Waves

### P1 — Shell chrome — done

- [x] `TopHeader` loading pill Motion + FetchBar (`shell-header-loading`)
- [x] `TopHeader` profile menu Motion
- [x] Sidebar pending `VH_MOTION_SPINNER`
- [x] Catalog `shellHeaderLoading`

### P2 — Hub overlays — done

- [x] `ProjectHubSettingsPopover`
- [x] `ProjectHubIssueMoreMenu`
- [x] `ProjectHubChangeRequestDetailDrawer` + `TabPanelMotion`
- [x] `WorkItemDetail` modal/drawer Motion + tab panel
- [x] `ProjectHubListAssigneeCell` / `ListBulkBar` / `SprintSection` menus
- [x] `TaskBoardCardActionsMenu` / `TaskBoardListActionsMenu`
- [x] `ProjectHubInlineCreateBar` type menu
- [x] `ProjectHubBacklogIssueRow` epic picker
- [x] `ProjectHubMembersPanel` tab menu
- [x] Shared `Modal` / `ProjectHubTcDetailModal` (đã Motion sẵn)

### P3 — Delivery modules (board/list/tc/cr) — done

- [x] Overview cards `VH_MOTION_CARD` + charts `MotionFadeIn`
- [x] Board cards `VH_MOTION_CARD` + toolbar `VH_MOTION_BTN` (DnD domain giữ nguyên)
- [x] List rows `VH_MOTION_ROW` + spinners
- [x] **List polish:** toolbar Expand/Collapse `VH_MOTION_BTN`; empty-load `QueryStateView`; footer create/refresh `VH_MOTION_BTN`; row priority/status/date `VH_MOTION_FIELD`; create-under `MotionPresence`+fade; inline create title `VH_MOTION_FIELD`
- [x] TC / CR / Execution: `QueryStateView`
- [x] Phase1/Phase4/ModuleRoute/Shell/Meetings/ClosureReport: `VH_MOTION_SPINNER`
- [x] `ProjectChatWorkspace` messages → `QueryStateView`

### P4 — Collab + Ops suite groups — done

| Group | Module | Surface | Pattern |
|-------|--------|---------|---------|
| **COLLAB** | Documents | `DriveWorkspaceShell` | Empty load `QueryStateView`; open/retry/back `VH_MOTION_BTN`; spinners `VH_MOTION_SPINNER` |
| **COLLAB** | Chat | `ProjectChatProjectsSidebar` | Project/channel rows `VH_MOTION_ROW` |
| **COLLAB** | Chat | `ProjectChatWorkspace` | Load older + composer leading icons `VH_MOTION_BTN` (send via `UnifiedChatComposer`) |
| **COLLAB** | Calendar | `CalendarFigmaView` | `feedLoading` grid skeleton `VH_MOTION_SKELETON` (create/nav đã `VH_MOTION_BTN` qua `figmaCalendarClasses`) |
| **COLLAB** | Meetings | `ProjectMeetingsPanel` | Section `VH_MOTION_CARD`; create `VH_MOTION_BTN`; list spinner giữ `VH_MOTION_SPINNER` |
| **OPS** | Activity | `ProjectHubShell` `ActivityPanel` | Items `VH_MOTION_CARD`; pagination `VH_MOTION_BTN`; overview fetch `QueryStateView` |
| **OPS** | Settings | `ProjectHubSettingsPanel` | Group tiles `VH_MOTION_CARD`; archive/delete danger `VH_MOTION_BTN` |
| **OPS** | Members | `ProjectHubMembersPanel` | Section cards `VH_MOTION_CARD` (+ rows `VH_MOTION_ROW` từ P2) |
| **OPS** | Reports | (existing) | Đã cover P3 — không đổi |

#### P4 gap audit (before → after)

| File / surface | Before | After |
|----------------|--------|-------|
| `DriveWorkspaceShell` load empty | `Loader2` + `motion-safe:animate-spin` | `QueryStateView` + `VH_MOTION_SPINNER` on inline busy |
| `DriveWorkspaceShell` CTAs | ad-hoc transition | `VH_MOTION_BTN` (retry, open, back, clear) |
| `ProjectChatProjectsSidebar` rows | hover only | `VH_MOTION_ROW` |
| `ProjectChatWorkspace` toolbar | plain border btn / icon `w-9` | `VH_MOTION_BTN` on load-older + leadingItems |
| `CalendarFigmaView` feed skeleton | `animate-pulse` | `VH_MOTION_SKELETON` |
| `ProjectMeetingsPanel` shell | plain `rounded-lg` | `VH_MOTION_CARD` + create `VH_MOTION_BTN` |
| `ActivityPanel` list + pager | plain border / hover | `VH_MOTION_CARD` / `VH_MOTION_BTN` |
| Overview recent activity load | `animate-pulse` block | `QueryStateView` skeleton |
| `ProjectHubSettingsPanel` tiles | transition-colors only | `VH_MOTION_CARD`; danger `VH_MOTION_BTN` |
| `ProjectHubMembersPanel` sections | `cardCls` no lift | `VH_MOTION_CARD` on `cardCls` |

## Primitive map (nhanh)

| Layer | Primitive |
|-------|-----------|
| Route switch | `PageMotion` + header pill + `FetchBar` |
| Dropdown | `MotionPresence` + `motionPopover` |
| Modal / drawer | `motionModalPanel` / `motionDrawerRight` |
| List/board | `VH_MOTION_ROW` / `VH_MOTION_CARD` |
| Async | `QueryStateView` / `VH_MOTION_SPINNER` / `VH_MOTION_SKELETON` |
| Tabs | `TabPanelMotion` |

## Playwright smoke

1. Overview → `.vh-presence-fade`; activity block loading → `QueryStateView` skeleton (no pulse bar)
2. Tài khoản → `[role=menu]` + `.vh-motion-row`
3. Đổi module sidebar → `[data-testid=shell-header-loading]` («Đang chuyển…»)
4. Board card → `.vh-motion-card`; list row → `.vh-motion-row`
4b. **List:** Mở/Thu gọn tất cả + refresh + `+ Tạo` → `.vh-motion-btn`; load empty → `QueryStateView` skeleton; create-under / type menu → `MotionPresence`; editable priority/status/date → `.vh-motion-field`
4c. **Overlay polish:** `MotionPresence initial` mặc định true; `motionPopover`/`motionPopoverUp` + scale; không CSS `translate-*` trên motion node; modal shell `motionOverlayShell` ổn định; WorkItemDetail giữ item khi exit; key stable list/board/timeline
5. **P4** Chat sidebar project/channel → `.vh-motion-row`
6. **P4** Documents (project files tab) → skeleton load; preview open → `.vh-motion-btn`
7. **P4** Calendar feed refresh → `.vh-skeleton` cells while loading
8. **P4** Settings group tile → `.vh-motion-card`; Activity tab item → `.vh-motion-card`
