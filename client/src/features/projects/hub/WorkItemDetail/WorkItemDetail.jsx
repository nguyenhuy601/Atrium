import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import OtOverrideConfirmModal from '../../../../features/adminTasks/OtOverrideConfirmModal';
import {
  FIGMA_ORG_MEMBER_PANEL_HEAD,
  FIGMA_ORG_MEMBER_PANEL_TITLE,
} from '../../../../components/Organization/figmaOrganizationClasses';
import ProjectHubIssueTypeBadge from '../ProjectHubIssueTypeBadge';
import { displayIssueKey } from '../projectHubUtils';
import { WorkItemDetailProvider, useWorkItemDetail } from './WorkItemDetailContext';
import OverviewTab from './OverviewTab';
import DescriptionTab from './DescriptionTab';
import ChildrenTab from './ChildrenTab';
import ActivityTab from './ActivityTab';
import AttachmentsTab from './AttachmentsTab';
import WorklogTab from './WorklogTab';
import ApprovalsTab from './ApprovalsTab';
import MotionPresence from '../../../../motion/primitives/MotionPresence';
import TabPanelMotion from '../../../../motion/primitives/TabPanelMotion';
import {
  motionBackdrop,
  motionDrawerRight,
  motionModalPanel,
  motionOverlayShell,
} from '../../../../motion/overlayMotion';
import useOverlayScrollLock from '../../../../motion/useOverlayScrollLock';
import { VH_MOTION_BTN } from '../../../../motion/classes';

const TAB_COMPONENTS = {
  overview: OverviewTab,
  description: DescriptionTab,
  children: ChildrenTab,
  activity: ActivityTab,
  attachments: AttachmentsTab,
  worklog: WorklogTab,
  approvals: ApprovalsTab,
};

function WorkItemDetailHeader() {
  const {
    workItem,
    issueId,
    workType,
    projectCode,
    title,
    setTitle,
    isPlanning,
    saving,
    save,
    onClose,
    t,
    listTitle,
  } = useWorkItemDetail();

  const rawType = String(workType || workItem?.issueType || workItem?.type || 'task').toLowerCase();

  return (
    <header className={FIGMA_ORG_MEMBER_PANEL_HEAD}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProjectHubIssueTypeBadge
            type={rawType === 'feature' ? 'feature' : rawType}
            variant="icon"
          />
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
            {displayIssueKey(projectCode, issueId)}
          </span>
          {listTitle ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {listTitle}
            </span>
          ) : null}
        </div>
        {isPlanning ? (
          <h3 className={`${FIGMA_ORG_MEMBER_PANEL_TITLE} mt-1 truncate`}>
            {workItem?.title || ''}
          </h3>
        ) : (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const next = title.trim();
              if (next && next !== String(workItem?.title || '')) void save({ title: next });
            }}
            disabled={saving}
            className={`${FIGMA_ORG_MEMBER_PANEL_TITLE} mt-1 w-full border-0 bg-transparent outline-none`}
            aria-label={t('workspace.projectHubWorkFieldTitle')}
          />
        )}
      </div>
      <button
        type="button"
        className={`rounded p-2 text-muted-foreground hover:text-foreground sm:p-1 ${VH_MOTION_BTN}`}
        onClick={onClose}
        aria-label={t('workspace.projectHubWorkDrawerClose')}
      >
        <X size={18} aria-hidden />
      </button>
    </header>
  );
}

function WorkItemDetailTabs() {
  const { visibleTabs, activeTab, setActiveTab, t } = useWorkItemDetail();
  const ids = visibleTabs.map((item) => item.id);
  const selectedId = ids.includes(activeTab) ? activeTab : ids[0] || 'overview';
  return (
    <div
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2"
      role="tablist"
      aria-label={t('workspace.projectHubWorkDetails')}
    >
      {visibleTabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={selectedId === item.id}
          onClick={() => setActiveTab(item.id)}
          className={`min-h-11 shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${VH_MOTION_BTN} ${
            selectedId === item.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {t(item.labelKey)}
        </button>
      ))}
    </div>
  );
}

function WorkItemDetailBody() {
  const { activeTab, visibleTabs } = useWorkItemDetail();
  const ids = visibleTabs.map((t) => t.id);
  const tabId = ids.includes(activeTab) ? activeTab : ids[0] || 'overview';
  const Comp = TAB_COMPONENTS[tabId] || OverviewTab;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-overlay">
      <TabPanelMotion activeKey={tabId}>
        <Comp />
      </TabPanelMotion>
    </div>
  );
}

function HoursOverrideHost() {
  const {
    hoursWarn,
    setHoursWarn,
    setPendingPatch,
    confirmHoursOverride,
    saving,
    t,
    buildHoursWarnMessage,
    assigneeId,
    assignableMembers,
    workItem,
  } = useWorkItemDetail();

  const hoursAssigneeName =
    workItem?.assigneeName ||
    (assignableMembers || []).find(
      (m) => String(m.userId || m.id) === String(assigneeId)
    )?.displayName ||
    (assignableMembers || []).find((m) => String(m.userId || m.id) === String(assigneeId))
      ?.name ||
    '';

  return (
    <OtOverrideConfirmModal
      isOpen={Boolean(hoursWarn)}
      onClose={() => {
        setHoursWarn(null);
        setPendingPatch(null);
      }}
      onConfirm={confirmHoursOverride}
      busy={saving}
      title={t('taskBoard.hoursOverrideTitle')}
      confirmText={t('taskBoard.hoursOverrideConfirm')}
      cancelText={t('taskBoard.cancelAria')}
      rationaleLabel={t('taskBoard.hoursOverrideRationale')}
      rationalePlaceholder={t('taskBoard.hoursOverridePlaceholder')}
      rationaleRequiredText={t('taskBoard.hoursOverrideNeedReason')}
      message={buildHoursWarnMessage(hoursWarn, t, hoursAssigneeName)}
    />
  );
}

function WorkItemDetailInner({
  chrome = 'modal',
  drawerLayout = 'embedded',
  onPresenceExitComplete,
}) {
  const { open, onClose, workItem, t, issueId } = useWorkItemDetail();
  const { release } = useOverlayScrollLock(Boolean(open));

  const handleExitComplete = () => {
    release();
    onPresenceExitComplete?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!issueId) return null;

  const panel = (
    <>
      <WorkItemDetailHeader />
      <WorkItemDetailTabs />
      <WorkItemDetailBody />
      <HoursOverrideHost />
    </>
  );

  if (chrome === 'drawer') {
    const isOverlayLayout = drawerLayout === 'overlay';

    return (
      <MotionPresence open={open} initial onExitComplete={handleExitComplete}>
        {isOverlayLayout ? (
          <motion.div
            key="work-item-detail-drawer-overlay"
            className="fixed inset-0 z-50 vh-motion-respect"
            {...motionOverlayShell}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label={t('workspace.projectHubWorkDrawerClose')}
              onClick={onClose}
              {...motionBackdrop}
            />
            <motion.aside
              className="absolute inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface shadow-lg"
              role="dialog"
              aria-modal="true"
              aria-label={workItem?.title || t('workspace.projectHubWorkDetails')}
              {...motionDrawerRight}
            >
              {panel}
            </motion.aside>
          </motion.div>
        ) : (
          <motion.div
            key="work-item-detail-drawer-embedded"
            className="contents"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
          >
            <motion.button
              type="button"
              className="fixed inset-0 z-30 bg-black/40 sm:hidden"
              aria-label={t('workspace.projectHubWorkDrawerClose')}
              onClick={onClose}
              {...motionBackdrop}
            />
            <motion.aside
              className="fixed inset-y-0 right-0 z-40 flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-border bg-surface sm:relative sm:z-auto sm:max-w-md"
              role="dialog"
              aria-modal="true"
              aria-label={workItem?.title || t('workspace.projectHubWorkDetails')}
              {...motionDrawerRight}
            >
              {panel}
            </motion.aside>
          </motion.div>
        )}
      </MotionPresence>
    );
  }

  if (typeof document === 'undefined') return null;

  // Flex-center overlay (như Shared Modal) — không dùng left/top 50% + -translate-* vì
  // motionModalPanel ghi đè transform và làm panel lệch góc dưới-phải.
  return createPortal(
    <MotionPresence open={open} initial onExitComplete={handleExitComplete}>
      <motion.div
        key="work-item-detail-modal"
        className="fixed inset-0 z-[10070] flex items-center justify-center p-2 sm:p-4 vh-motion-respect"
        {...motionOverlayShell}
      >
        <motion.div
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
          aria-hidden
          {...motionBackdrop}
        />
        <motion.div
          className="relative z-[10071] flex max-h-[min(92dvh,92vh)] w-[min(768px,96vw)] origin-center flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={workItem?.title || t('workspace.projectHubWorkDetails')}
          onClick={(e) => e.stopPropagation()}
          {...motionModalPanel}
        >
          {panel}
        </motion.div>
      </motion.div>
    </MotionPresence>,
    document.body
  );
}

/**
 * Work item detail thống nhất — Board/List (modal) và Backlog/CR (drawer).
 * Giữ workItem cuối khi `open=false` để MotionPresence kịp chạy exit
 * (parent thường clear detail id + workItem cùng lúc).
 */
export default function WorkItemDetail({
  open = false,
  chrome = 'modal',
  drawerLayout = 'embedded',
  workItem = null,
  ...providerProps
}) {
  const [heldItem, setHeldItem] = useState(workItem);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (workItem) setHeldItem(workItem);
  }, [workItem]);

  const item = workItem || heldItem;
  if (!item) return null;

  return (
    <WorkItemDetailProvider open={open} workItem={item} {...providerProps}>
      <WorkItemDetailInner
        chrome={chrome}
        drawerLayout={drawerLayout}
        onPresenceExitComplete={() => {
          if (!openRef.current) setHeldItem(null);
        }}
      />
    </WorkItemDetailProvider>
  );
}
