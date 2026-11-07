import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStrings } from '../../locales/appStrings';
import MotionMenu from '../../motion/primitives/MotionMenu';
import { VH_MOTION_BTN, VH_MOTION_ROW } from '../../motion/classes';
import {
  coerceDeliveryPhase,
  deliveryPhaseLabelKey,
} from '../../utils/projectPhaseNav';
import { buildProjectsModulePath, buildProjectsPickerPath } from '../../utils/suitePathUtils';
import { formatHubMethodology, projectInitials } from '../../features/projects/hub/projectHubUtils';
import {
  HUB_BADGE_CODE,
  HUB_BADGE_META,
  HUB_BADGE_PHASE,
} from '../../features/projects/hub/projectHubUiClasses';

/**
 * Compact project context beside TopHeader avatar — thay sticky ProjectHub identity header.
 */
export default function TopHeaderProjectMenu({
  projectId = '',
  projectRow = null,
  organizationId = '',
  roleBadges = [],
  /** lead = thay brand trái; trail = cạnh avatar */
  placement = 'trail',
}) {
  const { t } = useAppStrings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const title = String(
    projectRow?.title || projectRow?.name || projectRow?.projectTitle || ''
  ).trim();
  const code = String(projectRow?.projectCode || projectRow?.code || '').trim();
  const methodology = projectRow?.methodology || projectRow?.boardMethodology || '';
  const phase = coerceDeliveryPhase(projectRow?.deliveryPhase);
  const initials = projectInitials(title || code || 'PR');
  const orgId = String(
    organizationId || projectRow?.organizationId || projectRow?.organization?._id || ''
  ).trim();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!projectId) return null;

  const isLead = placement === 'lead';

  return (
    <div className="relative flex min-w-0 items-center gap-1.5" ref={rootRef}>
      {!isLead && roleBadges.length ? (
        <div className="hidden items-center gap-1 sm:flex" aria-label={t('nav.yourRole')}>
          {roleBadges.map((b) => (
            <span
              key={b.key}
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide ${b.className}`}
            >
              {b.short}
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={title || t('workspace.projectHubUntitled')}
        className={`flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-1.5 py-1 ${
          isLead ? 'max-w-[min(100%,22rem)]' : 'max-w-[9.5rem] sm:max-w-[14rem]'
        } ${VH_MOTION_BTN}`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[9px] font-black text-primary-foreground">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-left text-[11px] font-semibold leading-tight text-foreground">
            {title || t('workspace.projectHubUntitled')}
          </span>
          {isLead ? (
            <span className="mt-0.5 flex items-center gap-1">
              <span className={HUB_BADGE_PHASE}>{t(deliveryPhaseLabelKey(phase))}</span>
              {code ? <span className={`${HUB_BADGE_CODE} hidden sm:inline-flex`}>{code}</span> : null}
            </span>
          ) : null}
        </span>
        <ChevronDown size={12} className="shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <MotionMenu
        open={open}
        menuKey="top-header-project-menu"
        className={`absolute top-[calc(100%+6px)] z-[100] w-[280px] rounded-xl border border-border bg-surface shadow-xl ${
          isLead ? 'left-0' : 'right-0'
        }`}
      >
        <div className="overflow-hidden rounded-xl">
          <div className="border-b border-border px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {title || t('workspace.projectHubUntitled')}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {code ? <span className={HUB_BADGE_CODE}>{code}</span> : null}
                  {methodology ? (
                    <span className={HUB_BADGE_META}>{formatHubMethodology(methodology, t)}</span>
                  ) : null}
                  <span className={HUB_BADGE_PHASE}>{t(deliveryPhaseLabelKey(phase))}</span>
                </div>
                {roleBadges.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1 md:hidden">
                    {roleBadges.map((b) => (
                      <span
                        key={`m-${b.key}`}
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide ${b.className}`}
                      >
                        {b.short}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(buildProjectsModulePath(projectId, 'overview'));
              }}
              className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-foreground hover:bg-muted ${VH_MOTION_ROW}`}
            >
              <FolderKanban size={14} className="shrink-0 text-muted-foreground" aria-hidden />
              {t('workspace.projectHubTabOverview')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(buildProjectsPickerPath(orgId));
              }}
              className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[0.8125rem] text-foreground hover:bg-muted ${VH_MOTION_ROW}`}
            >
              <ArrowLeftRight size={14} className="shrink-0 text-muted-foreground" aria-hidden />
              {t('nav.projectsSwitch')}
            </button>
          </div>
        </div>
      </MotionMenu>
    </div>
  );
}
