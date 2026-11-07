import { useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import {
  HOW_MACRO_STEPS,
  WHAT_MACRO_STEPS,
  resolveAiHitlMonitorPhase,
  resolveMonitorResultsKind,
} from './aiHitlMonitorPhase';
import {
  formatElapsed,
  resolveWhatProgressViewModel,
} from './whatProgressViewModel';
import { resolveHowProgressViewModel } from './howProgressViewModel';
import HowMonitorResultsPanel from './HowMonitorResultsPanel';
import { shouldShowHowMonitorResults } from './howMonitorResultsVisibility';
import WhatMonitorResultsPanel from './WhatMonitorResultsPanel';
import { shouldShowWhatMonitorResults } from './whatMonitorResultsVisibility';
import { isHowRunWallTimedOut } from './WHAT_MONITOR_CONFIG';
import HowRerunToolPicker from './HowRerunToolPicker';
import AiRunProgressOverlay from './AiRunProgressOverlay';
import { resolveMonitorHeroText } from './MonitorRunLoadingCard';
import {
  countHowMacroProgress,
  countWhatMacroProgress,
} from './monitorProgressCounts';

function formatClock(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

/**
 * Prefer last known mid-run macro/substep for same run (fills brief gaps after resume).
 * Do NOT clamp upward (blocks re-run progress) and do NOT sticky Gate1/Approved (5+).
 */
function applyStickyWhatProgress(vm, stickyRef) {
  const runId = String(vm?.runId || '');
  const sticky = stickyRef.current;
  const state = String(vm?.state || '');
  if (!runId || state === 'idle' || state === 'failed' || state === 'cancelled') {
    stickyRef.current = { runId: '', macroStep: 0, substep: null };
    return vm;
  }
  let macroStep = Number(vm.macroStep) || 0;
  let substep = vm.substep || null;
  const inFlight = state === 'running' || state === 'queued';

  // Re-run / restart: drop sticky Gate1+ so Monitor can restart from early steps
  if (inFlight && sticky.runId === runId && sticky.macroStep >= 5) {
    stickyRef.current = { runId, macroStep: macroStep || 0, substep: substep || null };
  } else if (sticky.runId === runId) {
    // Gap-fill only (missing progress) within steps 1–4 — never force higher than live
    if (!macroStep && sticky.macroStep > 0 && sticky.macroStep < 5) {
      macroStep = sticky.macroStep;
      substep = sticky.substep || substep;
    } else if (!substep && sticky.substep && sticky.macroStep > 0 && sticky.macroStep < 5) {
      substep = sticky.substep;
      if (!macroStep) macroStep = sticky.macroStep;
    }
  }

  if (macroStep > 0 && macroStep < 5) {
    stickyRef.current = { runId, macroStep, substep };
  } else if (sticky.runId !== runId) {
    stickyRef.current = { runId, macroStep: 0, substep: null };
  } else if (macroStep >= 5 || (!macroStep && inFlight)) {
    // At Gate1+ or fresh in-flight without step: keep sticky empty / non-blocking
    stickyRef.current = { runId, macroStep: 0, substep: null };
  }

  if (macroStep === vm.macroStep && substep === vm.substep) return vm;
  const macroDef = WHAT_MACRO_STEPS.find((m) => m.step === macroStep) || null;
  return {
    ...vm,
    macroStep,
    substep,
    activeMacroSubsteps: macroDef ? [...macroDef.substeps] : vm.activeMacroSubsteps,
  };
}

function labelOf(t, key, fallback) {
  const value = typeof t === 'function' ? t(key) : '';
  return value || fallback;
}

function RunTimingFooter({ elapsedMs, startedAt, completedAt, inFlight, t }) {
  const elapsed = elapsedMs > 0 ? formatElapsed(elapsedMs) : '';
  const startedLabel = formatClock(startedAt);
  const endedLabel = !inFlight ? formatClock(completedAt) : '';
  if (!elapsed && !startedLabel) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
      {elapsed ? (
        <p>
          <span className="font-medium text-foreground/80">
            {labelOf(t, 'requirements.aiHitlMonitorElapsed', 'Thời gian chạy')}:
          </span>{' '}
          <span className="tabular-nums text-foreground">{elapsed}</span>
          {inFlight ? (
            <span className="ml-1 text-[10px] uppercase tracking-wide text-primary">
              {labelOf(t, 'requirements.aiHitlMonitorElapsedLive', 'đang chạy')}
            </span>
          ) : null}
        </p>
      ) : null}
      {startedLabel ? (
        <p>
          <span className="font-medium text-foreground/80">
            {labelOf(t, 'requirements.aiHitlMonitorStartedAt', 'Bắt đầu')}:
          </span>{' '}
          <span className="tabular-nums">{startedLabel}</span>
        </p>
      ) : null}
      {endedLabel ? (
        <p>
          <span className="font-medium text-foreground/80">
            {labelOf(t, 'requirements.aiHitlMonitorEndedAt', 'Kết thúc')}:
          </span>{' '}
          <span className="tabular-nums">{endedLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Terminal banner only for real BE errors / cancel — no FE-invented stale/wall copy.
 * @param {{ quiet?: boolean }} opts — wall-timeout FE force-fail: hide banner (rerun picker still shows).
 */
function RunTerminalBanner({ state, errorMessage, actionSlot = null, quiet = false, t }) {
  if (quiet) return actionSlot || null;

  const isFailed = state === 'failed' || state === 'error';
  const isCancelled = state === 'cancelled';
  const isIncomplete = state === 'incomplete';
  const beError = String(errorMessage || '').trim();
  // Skip empty failed/incomplete noise; cancel always worth a short title.
  if (!isCancelled && !beError) return actionSlot || null;
  if (!isFailed && !isCancelled && !isIncomplete) return null;

  const toneClass = isIncomplete
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
    : 'border-destructive/40 bg-destructive/10 text-destructive';
  const bodyClass = isIncomplete ? 'text-amber-900/90 dark:text-amber-100/90' : 'text-destructive/90';

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${toneClass}`} role="alert">
      <p className="font-semibold text-sm">
        {isCancelled
          ? labelOf(t, 'requirements.aiHitlMonitorRunCancelled', 'Chạy AI đã bị hủy')
          : isIncomplete
            ? labelOf(t, 'requirements.aiHitlMonitorRunIncomplete', 'HOW chưa hoàn tất')
            : labelOf(t, 'requirements.aiHitlMonitorRunFailed', 'Chạy AI thất bại')}
      </p>
      {beError ? <p className={`mt-1 break-words ${bodyClass}`}>{beError}</p> : null}
      {actionSlot}
    </div>
  );
}

function WhatMonitorBody({
  liveRun,
  phaseWhat,
  packStatus,
  pipeline,
  phaseDone,
  hasProposeOutput = false,
  /** Optimistic re-run window — keep overlay open before pack/live statuses converge. */
  forceLoading = false,
  rerunWhatButton = null,
  t,
}) {
  const [now, setNow] = useState(() => Date.now());
  const stickyRef = useRef({ runId: '', macroStep: 0, substep: null });
  const packNorm = String(packStatus || '')
    .trim()
    .toLowerCase();
  const srsApproved = packNorm === 'approved' || packNorm === 'project_linked';
  const liveForWhat =
    liveRun ||
    (pipeline?.substep
      ? { pipelineSubstep: pipeline.substep, pipelineStep: pipeline.step }
      : null);

  const rawVm = resolveWhatProgressViewModel(
    liveForWhat,
    phaseWhat,
    now,
    undefined,
    packStatus,
    hasProposeOutput
  );
  const vm = phaseDone ? rawVm : applyStickyWhatProgress(rawVm, stickyRef);
  const clockLive = !phaseDone && (vm.state === 'running' || vm.state === 'queued');
  const runBusy =
    !phaseDone &&
    (clockLive ||
      hasProposeOutput ||
      vm.state === 'finalizing' ||
      vm.state === 'waiting_human');
  const terminalFail =
    vm.state === 'failed' || vm.state === 'cancelled' || vm.state === 'error';
  const showLoadingCard =
    Boolean(forceLoading) ||
    (!phaseDone &&
      !srsApproved &&
      !vm.waitingHuman &&
      !terminalFail &&
      (vm.state === 'running' || vm.state === 'queued' || vm.state === 'finalizing'));

  useEffect(() => {
    if (!clockLive && !forceLoading) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clockLive, forceLoading]);

  const activeMacro = srsApproved
    ? 6
    : phaseDone
      ? 5
      : vm.macroStep > 0
        ? vm.macroStep
        : stickyRef.current.macroStep || 0;
  const macroDef =
    WHAT_MACRO_STEPS.find((m) => m.step === (activeMacro > 0 ? activeMacro : 1)) ||
    WHAT_MACRO_STEPS[0];
  const phaseLabel = `${labelOf(t, 'requirements.aiHitlMonitorWhatShort', 'WHAT')} · ${labelOf(
    t,
    macroDef.labelKey,
    macroDef.fallback
  )}`;
  const progress = countWhatMacroProgress({
    activeMacroSubsteps: vm.activeMacroSubsteps,
    substep: vm.substep,
  });
  const heroText = resolveMonitorHeroText(vm.activity, progress.currentIds, t);

  return (
    <section className="rounded-xl border border-border/80 bg-card/95 px-3 py-3 shadow-sm sm:px-4 sm:py-4">
      <h3 className="text-sm font-semibold text-foreground sm:text-base">
        {labelOf(t, 'requirements.aiHitlMonitorWhatTitle', 'Phase WHAT — Requirement AI')}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
        {labelOf(
          t,
          srsApproved
            ? 'requirements.aiHitlMonitorMacroDesc6'
            : phaseDone
              ? 'requirements.aiHitlMonitorWhatDone'
              : vm.descriptionKey,
          srsApproved
            ? 'SRS đã được duyệt.'
            : phaseDone
              ? 'WHAT xong — mở tab Duyệt để Gate 1 (BA → PO).'
              : vm.descriptionFallback
        )}
      </p>
      {vm.waitingHuman ? (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100">
          {labelOf(
            t,
            'requirements.aiHitlMonitorDataGateHint',
            'AI đang chờ Data Gate — chuyển tab Duyệt để Pass/Reject.'
          )}
        </p>
      ) : null}
      <RunTerminalBanner
        state={vm.state}
        errorMessage={vm.errorMessage}
        actionSlot={terminalFail ? rerunWhatButton : null}
        t={t}
      />
      <AiRunProgressOverlay
        open={showLoadingCard}
        phaseLabel={phaseLabel}
        done={progress.done}
        total={progress.total}
        heroText={heroText}
        showSpinner={Boolean(forceLoading || vm.showSpinner)}
        t={t}
      />
      {phaseDone &&
      !srsApproved &&
      !runBusy &&
      !terminalFail
        ? rerunWhatButton
        : null}
      <RunTimingFooter
        elapsedMs={vm.elapsedMs}
        startedAt={vm.startedAt}
        completedAt={vm.completedAt}
        inFlight={clockLive}
        t={t}
      />
    </section>
  );
}

/**
 * HOW Monitor — progress overlay for in-flight; summary when done (RULE-M01).
 */
function HowMonitorBody({
  liveRun,
  phaseHow,
  phaseDone,
  howNotStarted,
  hasProposeOutput = false,
  /** Optimistic re-run window — keep overlay open before pack/live statuses converge. */
  forceLoading = false,
  startHowButton,
  howRerunPicker = null,
  t,
}) {
  const [now, setNow] = useState(() => Date.now());
  const vm = resolveHowProgressViewModel(liveRun, phaseHow, now, hasProposeOutput);
  const clockLive =
    !phaseDone && !howNotStarted && (vm.state === 'running' || vm.state === 'queued');
  const runBusy =
    !phaseDone &&
    !howNotStarted &&
    (clockLive ||
      Boolean(forceLoading) ||
      hasProposeOutput ||
      vm.state === 'finalizing' ||
      vm.state === 'waiting_human');

  useEffect(() => {
    if (!clockLive && !forceLoading) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clockLive, forceLoading]);

  const howFailed = vm.state === 'failed' || vm.state === 'cancelled' || vm.state === 'error';
  const howIncomplete = vm.state === 'incomplete';
  const howTerminalStopped = howFailed || howIncomplete;
  const wallQuiet = Boolean(vm.wallTimedOut);
  const activeMacro =
    phaseDone || howNotStarted || howTerminalStopped ? 0 : vm.macroStep || 1;
  const showLoadingCard =
    Boolean(forceLoading) ||
    (!phaseDone &&
      !howNotStarted &&
      !howTerminalStopped &&
      !vm.waitingHuman &&
      (vm.state === 'running' || vm.state === 'queued' || vm.state === 'finalizing'));

  const macroDef = HOW_MACRO_STEPS.find((m) => m.step === activeMacro) || null;
  const phaseLabel = macroDef
    ? `${labelOf(t, 'requirements.aiHitlMonitorHowShort', 'HOW')} · ${labelOf(
        t,
        macroDef.labelKey,
        macroDef.fallback
      )}`
    : labelOf(t, 'requirements.aiHitlMonitorHowShort', 'HOW');
  const progress = countHowMacroProgress({
    macroStep: activeMacro,
    activeMacroSubsteps: vm.activeMacroSubsteps,
    activeStepId: vm.activeStepId,
    activeStepIds: vm.activeStepIds,
    planningLayers: vm.planningLayers,
    toolExecutions: vm.toolExecutions,
  });
  const heroText = resolveMonitorHeroText(vm.activity, progress.currentIds, t);

  let howDescKey = vm.descriptionKey;
  let howDescFallback = vm.descriptionFallback;
  if (phaseDone) {
    howDescKey = 'requirements.aiHitlMonitorHowDone';
    howDescFallback = 'HOW xong — mở tab Duyệt để xác nhận Gate 2 & kích hoạt.';
  } else if (howNotStarted) {
    howDescKey = 'requirements.aiHitlMonitorHowReady';
    howDescFallback = 'Gate 1 xong — chạy AI Planning (HOW) tại đây.';
  } else if (wallQuiet || howIncomplete || (howFailed && vm.state !== 'cancelled')) {
    // Terminal stop: no scare/hint blurbs — banner (BE error) + rerun picker suffice.
    howDescKey = 'requirements.aiHitlMonitorHowTitle';
    howDescFallback = 'Phase HOW — Planning AI';
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card/95 px-3 py-3 shadow-sm sm:px-4 sm:py-4">
      <h3 className="text-sm font-semibold text-foreground sm:text-base">
        {labelOf(t, 'requirements.aiHitlMonitorHowTitle', 'Phase HOW — Planning AI')}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
        {labelOf(t, howDescKey, howDescFallback)}
      </p>
      <RunTerminalBanner
        state={vm.state}
        errorMessage={vm.errorMessage}
        quiet={wallQuiet}
        actionSlot={null}
        t={t}
      />
      <AiRunProgressOverlay
        open={showLoadingCard}
        phaseLabel={phaseLabel}
        done={progress.done}
        total={progress.total}
        heroText={heroText}
        showSpinner={Boolean(forceLoading || vm.showSpinner)}
        t={t}
      />
      {howNotStarted ? startHowButton : null}
      {(phaseDone || howTerminalStopped || (!howNotStarted && !runBusy)) &&
      howRerunPicker
        ? howRerunPicker
        : null}
      <RunTimingFooter
        elapsedMs={vm.elapsedMs}
        startedAt={vm.startedAt}
        completedAt={vm.completedAt}
        inFlight={clockLive}
        t={t}
      />
    </section>
  );
}

/**
 * LangGraph / APS run monitor — progress overlay (live) or summary (done). RULE-M01.
 */
export default function AiHitlMonitorPanel({
  liveRun = null,
  phaseWhat = null,
  phaseHow = null,
  pack = null,
  packStatus = '',
  pipeline = null,
  bootstrapping = false,
  /** 'what' | 'how' | null — re-run start window; force progress UI + hide stale tables. */
  awaitingFreshRun = null,
  canStartWhat = false,
  canRerunWhat = false,
  canRunHow = false,
  canRerunHow = false,
  whatStartBusy = false,
  howStartBusy = false,
  onStartWhat = null,
  onRerunWhat = null,
  onStartHow = null,
  onRerunHow = null,
  onRerunHowSelected = null,
  organizationId = null,
  packId = null,
  onRefresh = null,
  onOpenGate2 = null,
  canConfirmWbs = true,
  canApprovePlan = false,
  t,
}) {
  let phase = resolveAiHitlMonitorPhase({
    packStatus,
    phaseWhat,
    phaseHow,
    liveRun,
  });
  // Re-run / start loading: show in-progress checklist, not prior *_done + old tables.
  if (awaitingFreshRun === 'what') phase = 'what';
  else if (awaitingFreshRun === 'how') phase = 'how';

  const packNorm = String(packStatus || '').trim().toLowerCase();
  const howStatus = String(phaseHow?.status || '').trim().toLowerCase();
  const whatStatus = String(phaseWhat?.status || '').trim().toLowerCase();
  const liveStatus = String(liveRun?.status || '').trim().toLowerCase();
  const howNotStarted =
    packNorm === 'approved' &&
    ![
      'pending',
      'running',
      'queued',
      'waiting_human',
      'waiting_external',
      'ready',
      'completed',
      'confirmed',
      'failed',
      'error',
      'stopped',
      'incomplete',
      'cancelled',
    ].includes(howStatus);
  const showHowReady =
    phase === 'what_done' &&
    packNorm === 'approved' &&
    howNotStarted;
  const howStatusInFlight = ['pending', 'running', 'queued', 'waiting_human'].includes(
    howStatus
  );
  const howWallStale = isHowRunWallTimedOut(liveRun, phaseHow);
  // Zombie BE "running" past wall → not in-flight for disable / poll UX.
  const howInFlight = howStatusInFlight && !howWallStale;
  const startBusy = Boolean(whatStartBusy || howStartBusy);
  const whatPhaseReady = ['ready', 'completed', 'confirmed'].includes(whatStatus);
  const howPhaseReady = ['ready', 'completed', 'confirmed'].includes(howStatus);
  // Hide results only while the active phase is truly in-flight. Sticky liveRun
  // (waiting_human / running) after phase_* already ready must not blank Monitor
  // while Duyệt already shows the first AI baseline from srsProposal / planning.
  const monitorInFlight =
    Boolean(awaitingFreshRun) ||
    startBusy ||
    (!whatPhaseReady &&
      ['pending', 'running', 'queued', 'waiting_human'].includes(whatStatus)) ||
    howInFlight ||
    (!whatPhaseReady &&
      !howPhaseReady &&
      ['pending', 'running', 'queued', 'waiting_human'].includes(liveStatus) &&
      !howWallStale);

  const startWhatButton =
    canStartWhat && typeof onStartWhat === 'function' ? (
      <button
        type="button"
        disabled={whatStartBusy}
        onClick={onStartWhat}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {whatStartBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
        {labelOf(t, 'requirements.aiHitlStartWhat', 'Chạy AI WHAT')}
      </button>
    ) : null;

  const rerunWhatButton =
    canRerunWhat && typeof onRerunWhat === 'function' ? (
      <button
        type="button"
        disabled={whatStartBusy}
        onClick={onRerunWhat}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-40"
        title={labelOf(
          t,
          'requirements.aiHitlReviseUnderReviewHint',
          'Chạy lại AI — reset duyệt BA→PO, BA phải xác nhận lại'
        )}
      >
        {whatStartBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
        {labelOf(t, 'requirements.aiHitlRevise', 'AI revise / chạy lại')}
      </button>
    ) : null;

  const startHowButton =
    howNotStarted && typeof onStartHow === 'function' ? (
      <button
        type="button"
        disabled={!canRunHow || howStartBusy}
        onClick={onStartHow}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {howStartBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
        {labelOf(t, 'requirements.aiPlanningStart', 'Chạy AI Planning')}
      </button>
    ) : null;

  const showRerunHow =
    typeof onRerunHow === 'function' &&
    !howNotStarted &&
    (canRerunHow || (howWallStale && canRunHow));
  const howRerunPicker = showRerunHow ? (
    <HowRerunToolPicker
      disabled={howInFlight}
      busy={howStartBusy || howInFlight}
      onRerunFull={onRerunHow}
      onRerunSelected={
        typeof onRerunHowSelected === 'function' ? onRerunHowSelected : onRerunHow
      }
      t={t}
    />
  ) : null;
  let body = null;

  if (phase === 'idle' && bootstrapping) {
    body = (
      <section className="rounded-md border border-border bg-card px-3 py-4">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          {labelOf(
            t,
            'requirements.aiHitlMonitorBootstrapping',
            'Đang khởi động AI WHAT sau khi tạo dự án nháp…'
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {labelOf(
            t,
            'requirements.aiHitlMonitorBootstrappingHint',
            'Chuẩn bị dữ liệu đầu vào rồi chạy phân tích — Monitor sẽ cập nhật từng bước.'
          )}
        </p>
      </section>
    );
  } else if (phase === 'idle') {
    body = (
      <section className="rounded-md border border-dashed border-border bg-card px-3 py-4">
        <p className="text-sm text-muted-foreground">
          {labelOf(
            t,
            'requirements.aiHitlMonitorIdle',
            'Chưa chạy AI. Bấm «Chạy AI WHAT» để bắt đầu — Monitor sẽ hiện từng bước WHAT.'
          )}
        </p>
        {startWhatButton}
      </section>
    );
  } else if (phase === 'what') {
    body = (
      <WhatMonitorBody
        liveRun={liveRun}
        phaseWhat={phaseWhat}
        packStatus={packStatus}
        pipeline={pipeline}
        phaseDone={false}
        hasProposeOutput={!awaitingFreshRun && shouldShowWhatMonitorResults(pack)}
        forceLoading={awaitingFreshRun === 'what'}
        rerunWhatButton={rerunWhatButton}
        t={t}
      />
    );
  } else if (showHowReady) {
    body = (
      <HowMonitorBody
        liveRun={liveRun}
        phaseHow={phaseHow}
        phaseDone={false}
        howNotStarted
        hasProposeOutput={false}
        forceLoading={awaitingFreshRun === 'how'}
        startHowButton={startHowButton}
        howRerunPicker={howRerunPicker}
        t={t}
      />
    );
  } else if (phase === 'what_done') {
    body = (
      <WhatMonitorBody
        liveRun={liveRun}
        phaseWhat={phaseWhat}
        packStatus={packStatus}
        pipeline={pipeline}
        phaseDone
        hasProposeOutput={!awaitingFreshRun && shouldShowWhatMonitorResults(pack)}
        forceLoading={false}
        rerunWhatButton={rerunWhatButton}
        t={t}
      />
    );
  } else if (phase === 'how' || phase === 'how_done') {
    body = (
      <HowMonitorBody
        liveRun={liveRun}
        phaseHow={phaseHow}
        // Re-run window: never treat prior how_done as finished while overlay must stay open.
        phaseDone={phase === 'how_done' && awaitingFreshRun !== 'how'}
        howNotStarted={phase === 'how' && howNotStarted && awaitingFreshRun !== 'how'}
        hasProposeOutput={
          !awaitingFreshRun && phase === 'how'
            ? shouldShowHowMonitorResults(pack)
            : phase === 'how_done' && awaitingFreshRun !== 'how'
        }
        forceLoading={awaitingFreshRun === 'how'}
        startHowButton={startHowButton}
        howRerunPicker={howRerunPicker}
        t={t}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground sm:text-base">
          {labelOf(t, 'requirements.aiHitlMonitorTitle', 'Theo dõi tiến trình AI')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {labelOf(
            t,
            'requirements.aiHitlMonitorHint',
            'Theo dõi từng bước WHAT / HOW. Kết quả phân tích ở bên dưới — duyệt quyết định ở tab Duyệt.'
          )}
        </p>
      </div>
      {body}
      {!monitorInFlight &&
      resolveMonitorResultsKind(phase, showHowReady) === 'what' &&
      shouldShowWhatMonitorResults(pack) ? (
        <WhatMonitorResultsPanel pack={pack} t={t} />
      ) : null}
      {!monitorInFlight &&
      resolveMonitorResultsKind(phase, showHowReady) === 'how' &&
      shouldShowHowMonitorResults(pack) ? (
        <HowMonitorResultsPanel
          pack={pack}
          t={t}
          organizationId={organizationId}
          packId={packId}
          onRefresh={onRefresh}
          onOpenGate2={onOpenGate2}
          canConfirmWbs={canConfirmWbs}
          canApprovePlan={canApprovePlan}
        />
      ) : null}
    </div>
  );
}
