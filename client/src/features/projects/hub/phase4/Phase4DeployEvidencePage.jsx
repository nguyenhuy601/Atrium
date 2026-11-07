import { ExternalLink, Loader2 } from 'lucide-react';
import { VH_MOTION_SPINNER } from '../../../../motion/classes';
import MotionFadeIn from '../../../../motion/primitives/MotionFadeIn';
import { useAppStrings } from '../../../../locales/appStrings';
import { AdminLoadErrorState } from '../../../../components/adminUsers/adminPanelStates';
import usePhase4Handover from './usePhase4Handover';
import Phase4SectionCard from './Phase4SectionCard';

const FIELD_CLASS =
  'rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground shadow-sm outline-none transition-colors motion-reduce:transition-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring';

const BTN_CLASS =
  'rounded-lg border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Phase 4 Deploy evidence — Ops outside app; HITL URL + verify tick. No Deploy button.
 */
export default function Phase4DeployEvidencePage({ projectId }) {
  const { t } = useAppStrings();
  const {
    isLoading,
    isLoadError,
    loadFailMessage,
    retryLoad,
    checklist,
    evidence,
    draft,
    setEvidenceDraft,
    canPhase,
    uatPassed,
    busy,
    saveEvidence,
    setChecklistItem,
    releaseLabel,
  } = usePhase4Handover(projectId);

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (isLoadError) {
    return (
      <div className="p-4">
        <AdminLoadErrorState message={loadFailMessage} onRetry={retryLoad} />
      </div>
    );
  }

  const verified = Boolean(checklist.deployment_verified);
  const updateDraft = (patch) =>
    setEvidenceDraft((prev) => ({ ...(prev || evidence), ...patch }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3 sm:p-4" aria-busy={busy ? 'true' : undefined}>
      <Phase4SectionCard
        title={t('workspace.phaseDeployOutsideTitle')}
        description={t('workspace.phaseDeployOutsideBody')}
        delay={0}
        aside={
          releaseLabel ? (
            <span className="rounded-md border border-border/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {releaseLabel}
            </span>
          ) : null
        }
      >
        {!uatPassed ? (
          <MotionFadeIn delay={0.04}>
            <p className="text-[11px] font-semibold text-warning">
              {t('workspace.phaseDeployWaitUat')}
            </p>
          </MotionFadeIn>
        ) : (
          <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-muted-foreground">
            {[
              t('workspace.phaseDeployStep1'),
              t('workspace.phaseDeployStep2'),
              t('workspace.phaseDeployStep3'),
            ].map((step, index) => (
              <MotionFadeIn key={step} as="li" delay={0.04 + index * 0.045}>
                {step}
              </MotionFadeIn>
            ))}
          </ol>
        )}
        <MotionFadeIn delay={0.12}>
          <p className="mt-2 text-[11px] font-medium text-muted-foreground">
            {t('workspace.phase4NoDeployHint')}
          </p>
        </MotionFadeIn>
      </Phase4SectionCard>

      <Phase4SectionCard
        title={t('workspace.phaseNavDeployEvidence')}
        description={t('workspace.phaseDeployVerifyHint')}
        delay={0.08}
      >
        {!uatPassed || !canPhase ? (
          <p className="text-[11px] text-muted-foreground">
            {!uatPassed
              ? t('workspace.phaseDeployWaitUat')
              : t('workspace.phaseHandoverChecklistPmOnly')}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <MotionFadeIn delay={0.04} className="flex flex-col gap-1 text-[11px]">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {t('workspace.phaseDeployEvidenceEnv')}
                </span>
                <select
                  className={FIELD_CLASS}
                  value={draft.env || 'production'}
                  disabled={busy}
                  onChange={(e) => updateDraft({ env: e.target.value })}
                >
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                </select>
              </label>
            </MotionFadeIn>
            <MotionFadeIn delay={0.08} className="flex flex-col gap-1 text-[11px] sm:col-span-2">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {t('workspace.phaseDeployEvidenceUrl')}
                </span>
                <input
                  type="url"
                  className={FIELD_CLASS}
                  placeholder="https://…"
                  value={draft.pipelineUrl}
                  disabled={busy}
                  onChange={(e) => updateDraft({ pipelineUrl: e.target.value })}
                />
              </label>
            </MotionFadeIn>
            <MotionFadeIn delay={0.12} className="flex flex-col gap-1 text-[11px] sm:col-span-2">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {t('workspace.phaseDeployEvidenceNotes')}
                </span>
                <textarea
                  rows={3}
                  className={FIELD_CLASS}
                  placeholder={t('workspace.phaseDeployEvidenceNotesPh')}
                  value={draft.notes}
                  disabled={busy}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                />
              </label>
            </MotionFadeIn>
            <MotionFadeIn delay={0.16} className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={busy}
                aria-busy={busy ? 'true' : undefined}
                onClick={() => void saveEvidence()}
                className={BTN_CLASS}
              >
                {busy ? t('common.loading') : t('workspace.phaseDeployEvidenceSave')}
              </button>
              {evidence.at && evidence.pipelineUrl ? (
                <a
                  href={evidence.pipelineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary transition-colors hover:underline motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('workspace.phaseDeployEvidenceSavedAt')}
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              ) : null}
            </MotionFadeIn>
          </div>
        )}

        <MotionFadeIn delay={0.14}>
          <div className="mt-3 border-t border-border/60 pt-3">
            <label
              className={`flex items-start gap-2 rounded-xl border px-2.5 py-2.5 text-sm focus-within:ring-2 focus-within:ring-ring ${
                verified
                  ? 'border-success/40 bg-success/10'
                  : 'border-border/70 bg-muted/15'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                checked={verified}
                disabled={!canPhase || busy || !uatPassed}
                aria-busy={busy ? 'true' : undefined}
                onChange={(e) => void setChecklistItem('deployment_verified', e.target.checked)}
              />
              <span>
                <span className="font-semibold text-foreground">
                  {t('workspace.phaseQaChecklist_deployment_verified')}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {t('workspace.phaseDeployVerifyNeedUrl')}
                </span>
              </span>
            </label>
          </div>
        </MotionFadeIn>
      </Phase4SectionCard>
    </div>
  );
}
