/**
 * Guard Monitor UI during WHAT/HOW re-run start: poll may still return the previous
 * ready pack before the new run is visible.
 *
 * Also survives AiHitlWorkspace remount when navigate /ai-hitl/review → /ai-hitl
 * (awaitingFreshRun held in sessionStorage).
 */

export const PHASE_IN_FLIGHT = new Set([
  'pending',
  'running',
  'queued',
  'waiting_human',
  'waiting_external',
]);

const PHASE_TERMINAL = new Set([
  'ready',
  'completed',
  'confirmed',
  'failed',
  'error',
  'stopped',
  'incomplete',
  'cancelled',
]);

const AWAITING_STORAGE_PREFIX = 'atrium:aiHitl:awaitingFresh:';

/** Survives React remount even when packId is not yet on the URL. */
let memoryAwaitingFreshRun = null;

export function isPhaseInFlightStatus(status) {
  return PHASE_IN_FLIGHT.has(String(status || '').trim().toLowerCase());
}

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function phaseRunId(phaseMeta) {
  return String(phaseMeta?.remoteRunId || phaseMeta?.runId || '').trim();
}

function liveRunId(liveRun) {
  return String(liveRun?.runId || '').trim();
}

function awaitingStorageKey(packId) {
  const id = String(packId || '').trim();
  return id ? `${AWAITING_STORAGE_PREFIX}${id}` : '';
}

/** Survive remount when goMonitorTab navigates review → monitor. */
export function readStoredAwaitingFreshRun(packId) {
  if (memoryAwaitingFreshRun === 'how' || memoryAwaitingFreshRun === 'what') {
    return memoryAwaitingFreshRun;
  }
  const key = awaitingStorageKey(packId);
  if (!key || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = String(sessionStorage.getItem(key) || '').trim();
    return raw === 'how' || raw === 'what' ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredAwaitingFreshRun(packId, phase) {
  memoryAwaitingFreshRun = phase === 'how' || phase === 'what' ? phase : null;
  const key = awaitingStorageKey(packId);
  if (!key || typeof sessionStorage === 'undefined') return;
  try {
    if (memoryAwaitingFreshRun) sessionStorage.setItem(key, memoryAwaitingFreshRun);
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * True when poll payload shows a *new* run epoch — not a zombie liveRun left
 * "running"/"waiting_human" after the same phase already succeeded/failed.
 *
 * @param {object|null} prev — optimistic pack after onHowStarted / WHAT start
 * @param {object|null} next — fresh pack from API
 * @param {'what'|'how'} awaiting
 */
export function isFreshRunEpochVisible(prev, next, awaiting) {
  if (!awaiting || !next) return false;
  const phaseKey = awaiting === 'how' ? 'phase_how' : 'phase_what';
  const nextPhase = next?.aiAnalysis?.phaseRuns?.[phaseKey] || null;
  const nextPhaseStatus = norm(nextPhase?.status);
  const nextLive = next?.liveRun || null;
  const nextLiveStatus = norm(nextLive?.status);

  // BE stamped the phase as in-flight → new epoch accepted.
  if (isPhaseInFlightStatus(nextPhaseStatus)) return true;

  if (!isPhaseInFlightStatus(nextLiveStatus)) return false;

  // Live looks in-flight but phase is still terminal from the previous epoch.
  // Only release when live is clearly a newer run (id / startedAt).
  if (PHASE_TERMINAL.has(nextPhaseStatus)) {
    const liveId = liveRunId(nextLive);
    const phaseId = phaseRunId(nextPhase);
    if (liveId && phaseId && liveId !== phaseId) return true;

    const liveStarted = nextLive?.startedAt ? new Date(nextLive.startedAt).getTime() : NaN;
    const phaseEndedRaw =
      nextPhase?.completedAt || nextPhase?.finishedAt || nextPhase?.endedAt || null;
    const phaseEnded = phaseEndedRaw ? new Date(phaseEndedRaw).getTime() : NaN;
    if (
      Number.isFinite(liveStarted) &&
      Number.isFinite(phaseEnded) &&
      liveStarted > phaseEnded
    ) {
      return true;
    }

    return false;
  }

  return true;
}

function stampOptimisticPhase(next, awaiting) {
  const phaseKey = awaiting === 'how' ? 'phase_how' : 'phase_what';
  const nextAi = next?.aiAnalysis || {};
  const epochStartedAt = new Date().toISOString();
  return {
    ...next,
    aiAnalysis: {
      ...nextAi,
      ...(awaiting === 'how' ? { planning: undefined } : {}),
      phaseRuns: {
        ...(nextAi.phaseRuns || {}),
        [phaseKey]: {
          ...(nextAi.phaseRuns?.[phaseKey] || {}),
          status: 'pending',
          remoteRunId: null,
          error: null,
          pipelineStep: null,
          pipelineSubstep: null,
          startedAt: epochStartedAt,
        },
      },
    },
  };
}

/**
 * @param {object|null} prev
 * @param {object|null} next
 * @param {'what'|'how'|null} awaiting
 * @returns {{ pack: object|null, release: boolean }}
 */
export function protectPackDuringFreshRunAwait(prev, next, awaiting) {
  if (!awaiting) return { pack: next, release: true };

  if (isFreshRunEpochVisible(prev, next, awaiting)) {
    return { pack: next, release: true };
  }

  // Remount mid re-run: no optimistic prev — do NOT release on stale ready pack.
  if (!prev) {
    return { pack: stampOptimisticPhase(next, awaiting), release: false };
  }

  const phaseKey = awaiting === 'how' ? 'phase_how' : 'phase_what';
  const prevAi = prev.aiAnalysis || {};
  const nextAi = next?.aiAnalysis || {};
  const mergedAi = {
    ...nextAi,
    analyses: prevAi.analyses,
    phaseRuns: {
      ...(nextAi.phaseRuns || {}),
      [phaseKey]: prevAi.phaseRuns?.[phaseKey],
    },
  };
  if (awaiting === 'what') {
    mergedAi.gate1 = prevAi.gate1;
  } else {
    mergedAi.planning = prevAi.planning;
  }

  return {
    pack: {
      ...next,
      status: awaiting === 'what' ? prev.status : next.status,
      submittedBy: awaiting === 'what' ? prev.submittedBy : next.submittedBy,
      submittedAt: awaiting === 'what' ? prev.submittedAt : next.submittedAt,
      aiAnalysis: mergedAi,
    },
    release: false,
  };
}
