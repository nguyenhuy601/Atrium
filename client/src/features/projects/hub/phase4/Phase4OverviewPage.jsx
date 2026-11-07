import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  PackageCheck,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { VH_MOTION_BTN, VH_MOTION_CARD, VH_MOTION_SPINNER } from '../../../../motion/classes';
import MotionFadeIn from '../../../../motion/primitives/MotionFadeIn';
import MotionStagger from '../../../../motion/primitives/MotionStagger';
import { useAppStrings } from '../../../../locales/appStrings';
import {
  RELEASE_HANDOVER_CHECKLIST_IDS,
  deliveryPhaseLabelKey,
} from '../../../../utils/projectPhaseNav';
import { buildProjectsModulePath } from '../../../../utils/suitePathUtils';
import { AdminLoadErrorState } from '../../../../components/adminUsers/adminPanelStates';
import usePhase4Handover from './usePhase4Handover';

const SECTION =
  'rounded-2xl border border-border/80 bg-surface shadow-[0_1px_0_rgba(15,23,42,0.04)]';
const SECTION_PAD = 'p-4 sm:p-5';
const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
const FOCUS_LINK =
  'transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
/** Stagger step giữa item trong cùng section (giây). */
const ITEM_STAGGER = 0.045;

function StatusPill({ ok, okLabel, pendingLabel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ${
        ok ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
      }`}
    >
      {ok ? okLabel : pendingLabel}
    </span>
  );
}

/**
 * Phase 4 Overview — hero → KPI → checklist + CTA; MotionFadeIn + MotionStagger từng thành phần.
 */
export default function Phase4OverviewPage({ projectId }) {
  const { t } = useAppStrings();
  const {
    isLoading,
    isLoadError,
    loadFailMessage,
    retryLoad,
    checklist,
    checklistDone,
    checklistTotal,
    releaseLabel,
    readyConfirmed,
    uatPassed,
    evidence,
  } = usePhase4Handover(projectId);

  if (isLoading) {
    return (
      <div
        className="flex min-h-[12rem] items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (isLoadError) {
    return (
      <div className="p-4 sm:p-5">
        <AdminLoadErrorState message={loadFailMessage} onRetry={retryLoad} />
      </div>
    );
  }

  const progressPct = checklistTotal
    ? Math.round((checklistDone / checklistTotal) * 100)
    : 0;
  const allGateReady = readyConfirmed && uatPassed;
  const handoverPath = buildProjectsModulePath(projectId, 'handover');
  const evidencePath = buildProjectsModulePath(projectId, 'deploy-evidence');
  const releaseNotesPath = buildProjectsModulePath(projectId, 'release-notes');

  const kpiItems = [
    {
      key: 'checklist',
      value: `${progressPct}%`,
      label: t('workspace.phaseQaChecklistProgress', {
        done: checklistDone,
        total: checklistTotal,
      }),
      icon: ClipboardCheck,
      tone: progressPct >= 100 ? 'success' : progressPct > 0 ? 'primary' : '',
    },
    {
      key: 'ready',
      value: readyConfirmed
        ? t('workspace.phase4ChecklistDoneBadge')
        : t('workspace.phaseDeployStatusPending'),
      label: t('workspace.phase4BadgeReleaseReady'),
      icon: PackageCheck,
      tone: readyConfirmed ? 'success' : '',
    },
    {
      key: 'uat',
      value: uatPassed
        ? t('workspace.phase4ChecklistDoneBadge')
        : t('workspace.phaseDeployStatusPending'),
      label: t('workspace.phaseUatTitle'),
      icon: ShieldCheck,
      tone: uatPassed ? 'success' : '',
    },
  ];

  const ctaItems = [
    {
      key: 'handover',
      to: handoverPath,
      title: t('workspace.phase4OverviewCtaTitle'),
      hint: t('workspace.phase4OverviewCtaHint'),
      icon: ClipboardCheck,
    },
    {
      key: 'evidence',
      to: evidencePath,
      title: t('workspace.phaseNavDeployEvidence'),
      hint: t('workspace.phase4NoDeployHint'),
      icon: Rocket,
    },
    {
      key: 'notes',
      to: releaseNotesPath,
      title: t('workspace.phaseQaChecklist_release_notes'),
      hint: t('workspace.phase4ReleaseNotesHint'),
      icon: FileText,
    },
  ];

  const statusPills = [
    releaseLabel ? (
      <span
        key="release"
        className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-primary"
      >
        {t('workspace.phaseHandoverReleaseLabel')}: {releaseLabel}
      </span>
    ) : null,
    <StatusPill
      key="ready"
      ok={readyConfirmed}
      okLabel={`${t('workspace.phase4BadgeReleaseReady')}: ${t('workspace.phaseReleaseReadyConfirmed')}`}
      pendingLabel={`${t('workspace.phase4BadgeReleaseReady')}: ${t('workspace.phaseDeployStatusPending')}`}
    />,
    <StatusPill
      key="uat"
      ok={uatPassed}
      okLabel={t('workspace.phaseUatPass')}
      pendingLabel={t('workspace.phase4UatAwaiting', {
        status: t('workspace.phaseDeployStatusPending'),
      })}
    />,
  ].filter(Boolean);

  return (
    <div className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        {/* Hero — shell + từng khối bên trong */}
        <MotionFadeIn delay={0}>
          <header
            className={`${SECTION} relative overflow-hidden ${SECTION_PAD}`}
            aria-labelledby="phase4-overview-hero-title"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent"
              aria-hidden
            />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-2xl">
                <MotionFadeIn delay={ITEM_STAGGER}>
                  <p className={EYEBROW}>{t(deliveryPhaseLabelKey('release_handover'))}</p>
                  <h1
                    id="phase4-overview-hero-title"
                    className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
                  >
                    {t('workspace.phase4OverviewTitle')}
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t('workspace.phase4OverviewHint')}
                  </p>
                </MotionFadeIn>
                <MotionStagger className="mt-3 flex flex-wrap items-center gap-2">
                  {statusPills}
                </MotionStagger>
              </div>
              <MotionFadeIn delay={ITEM_STAGGER * 2}>
                <div
                  className="flex shrink-0 flex-col items-center justify-center rounded-2xl border border-border/70 bg-primary/5 px-5 py-4 text-center"
                  role="status"
                  aria-label={t('workspace.phaseQaChecklistProgress', {
                    done: checklistDone,
                    total: checklistTotal,
                  })}
                >
                  <span
                    className={`text-3xl font-semibold tabular-nums tracking-tight ${
                      allGateReady ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {progressPct}%
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {t('workspace.phaseQaChecklistProgress', {
                      done: checklistDone,
                      total: checklistTotal,
                    })}
                  </span>
                </div>
              </MotionFadeIn>
            </div>
            <MotionFadeIn delay={ITEM_STAGGER * 3}>
              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={checklistTotal}
                aria-valuenow={checklistDone}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </MotionFadeIn>
          </header>
        </MotionFadeIn>

        {/* KPI — stagger từng ô */}
        <MotionFadeIn delay={0.06}>
          <MotionStagger
            className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3"
            role="list"
            aria-label="Phase 4 readiness"
          >
            {kpiItems.map((item) => {
              const Icon = item.icon;
              const toneCls =
                item.tone === 'success'
                  ? 'text-success'
                  : item.tone === 'primary'
                    ? 'text-primary'
                    : 'text-foreground';
              return (
                <div
                  key={item.key}
                  role="listitem"
                  className="flex items-start gap-3 bg-surface px-4 py-4 sm:px-5"
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-primary/5 ${toneCls}`}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-base font-semibold tabular-nums leading-tight ${toneCls}`}>
                      {item.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              );
            })}
          </MotionStagger>
        </MotionFadeIn>

        {/* Checklist + CTAs */}
        <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <MotionFadeIn delay={0.1}>
            <section
              className={`${SECTION} ${SECTION_PAD}`}
              aria-labelledby="phase4-overview-checklist"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2
                  id="phase4-overview-checklist"
                  className="text-sm font-semibold text-foreground"
                >
                  {t('workspace.phaseQaHandoverChecklistTitle')}
                </h2>
                <Link
                  to={handoverPath}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline ${FOCUS_LINK} ${VH_MOTION_BTN}`}
                >
                  {t('workspace.phase4OverviewCtaTitle')}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {RELEASE_HANDOVER_CHECKLIST_IDS.map((id, index) => {
                  const on = Boolean(checklist[id]);
                  return (
                    <MotionFadeIn
                      key={id}
                      as="li"
                      delay={0.12 + index * ITEM_STAGGER}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs ${
                        on
                          ? 'border-success/30 bg-success/5'
                          : 'border-border/70 bg-muted/30'
                      }`}
                    >
                      {on ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span
                        className={
                          on ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        }
                      >
                        {t(`workspace.phaseQaChecklist_${id}`)}
                      </span>
                    </MotionFadeIn>
                  );
                })}
              </ul>
              {evidence.pipelineUrl ? (
                <MotionFadeIn delay={0.12 + RELEASE_HANDOVER_CHECKLIST_IDS.length * ITEM_STAGGER}>
                  <a
                    href={evidence.pipelineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline ${FOCUS_LINK}`}
                  >
                    {t('workspace.phaseDeployEvidenceUrl')}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </MotionFadeIn>
              ) : null}
            </section>
          </MotionFadeIn>

          <MotionFadeIn delay={0.14}>
            <section
              className={`${SECTION} ${SECTION_PAD}`}
              aria-labelledby="phase4-overview-actions"
            >
              <h2
                id="phase4-overview-actions"
                className="text-sm font-semibold text-foreground"
              >
                {t('workspace.phase4OverviewCtaTitle')}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {t('workspace.phase4OverviewCtaHint')}
              </p>
              <MotionStagger className="mt-3 flex flex-col gap-2">
                {ctaItems.map((cta) => {
                  const Icon = cta.icon;
                  return (
                    <Link
                      key={cta.key}
                      to={cta.to}
                      className={`flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 ${FOCUS_LINK} ${VH_MOTION_CARD}`}
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface text-primary"
                        aria-hidden
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground">
                          {cta.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                          {cta.hint}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </MotionStagger>
              <MotionFadeIn delay={0.2}>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {t('workspace.phase4NoDeployHint')}
                </p>
              </MotionFadeIn>
            </section>
          </MotionFadeIn>
        </div>
      </div>
    </div>
  );
}
