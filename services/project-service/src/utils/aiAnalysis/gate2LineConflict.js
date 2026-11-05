'use strict';

/**
 * Gate 2 line conflicts: project tracks[*].reviewDecisions → A/B sides + synthesis draft C.
 * RULE-09: every side / draft row must carry version + editor audit.
 */

const crypto = require('crypto');

const VERSION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function clip(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}

function inferSectionKey(logicalId) {
  const id = String(logicalId || '');
  if (id.startsWith('asg:')) return 'assignments';
  if (id.startsWith('dep:')) return 'dependencies';
  if (id.startsWith('task:') || id.startsWith('wbs:')) return 'wbs';
  if (id.startsWith('quality:') || id.startsWith('tc:')) return 'quality';
  if (id.startsWith('rel:') || id.startsWith('release:')) return 'releases';
  if (id.startsWith('sprint:')) return 'releases';
  if (id.startsWith('risk:')) return 'risks';
  return '';
}

function normalizeAction(raw) {
  const action = String(raw || '')
    .trim()
    .toLowerCase();
  if (action === 'accept' || action === 'edit' || action === 'reject') return action;
  return '';
}

function decisionEntries(reviewDecisions) {
  if (!reviewDecisions || typeof reviewDecisions !== 'object') return [];
  if (Array.isArray(reviewDecisions)) {
    return reviewDecisions
      .map((row) => {
        const logicalId = clip(row?.logicalId || row?.id, 160);
        if (!logicalId) return null;
        return { logicalId, decision: row };
      })
      .filter(Boolean);
  }
  return Object.entries(reviewDecisions).map(([logicalId, decision]) => ({
    logicalId: clip(logicalId, 160),
    decision,
  }));
}

function hasAudit(side) {
  const editor = clip(side?.editedBy || side?.submittedBy, 80);
  const at = clip(side?.editedAt || side?.submittedAt, 40);
  const version = clip(side?.versionLabel, 16);
  return Boolean(editor && at && version);
}

function versionLabelForIndex(index) {
  if (index >= 0 && index < VERSION_LETTERS.length) return VERSION_LETTERS[index];
  return `V${index + 1}`;
}

/**
 * Build one audited side from a submitted track + decision. Returns null if RULE-09 fails.
 */
function buildSide({
  roleKey,
  track,
  decision,
  versionLabel,
  decisionVersion = 1,
}) {
  const submittedBy = clip(track?.submittedBy, 80);
  const submittedAt = clip(track?.submittedAt, 40);
  if (!submittedBy || !submittedAt) return null;

  const action = normalizeAction(decision?.action) || 'accept';
  const editedPayload =
    action === 'edit' && decision?.editedPayload && typeof decision.editedPayload === 'object'
      ? decision.editedPayload
      : null;
  const payloadHash = stableHash({ action, editedPayload });
  const revisionId = clip(decision?.revisionId || '', 120);
  const editedBy = clip(decision?.editedBy || submittedBy, 80);
  const editedAt = clip(decision?.editedAt || submittedAt, 40);
  const editorDisplayName = clip(decision?.editorDisplayName || track?.editorDisplayName || '', 120);

  return {
    roleKey: clip(roleKey, 64).toLowerCase(),
    action,
    editedPayload,
    payloadHash,
    versionLabel: clip(versionLabel, 16),
    decisionVersion: Number(decisionVersion) > 0 ? Number(decisionVersion) : 1,
    revisionId: revisionId || `rev_${payloadHash}`,
    editedBy,
    submittedBy,
    editedAt,
    submittedAt,
    ...(editorDisplayName ? { editorDisplayName } : {}),
  };
}

function fingerprint(side) {
  return `${side.action}|${side.payloadHash}`;
}

function draftFromSide(side, { source, resolvedBy = null, resolvedAt = null } = {}) {
  return {
    action: side.action,
    source: source || `chosen:${side.roleKey}`,
    editedPayload: side.editedPayload,
    versionLabel: 'C',
    decisionVersion: side.decisionVersion || 1,
    chosenFromRole: side.roleKey,
    chosenFromVersionLabel: side.versionLabel,
    sourceEditedBy: side.editedBy || side.submittedBy,
    sourceEditedAt: side.editedAt || side.submittedAt,
    resolvedBy: resolvedBy || null,
    resolvedAt: resolvedAt || null,
  };
}

function draftBaseline({ builtAt }) {
  return {
    action: 'accept',
    source: 'baseline',
    editedPayload: null,
    versionLabel: 'C',
    decisionVersion: 1,
    chosenFromRole: null,
    chosenFromVersionLabel: null,
    sourceEditedBy: null,
    sourceEditedAt: null,
    resolvedBy: null,
    resolvedAt: builtAt || null,
  };
}

function conflictIdFor(logicalId, sideHashes) {
  const hash = stableHash({ logicalId, sideHashes: [...sideHashes].sort() });
  return `lc_${clip(logicalId, 80).replace(/[^a-zA-Z0-9:_-]/g, '_')}_${hash}`;
}

/**
 * @param {{ tracks: object, roleKeys?: string[] }} args
 * @returns {{ lineConflicts: object[], synthesisDraft: object }}
 */
function buildLineConflictsFromTracks({ tracks = {}, roleKeys = null } = {}) {
  const keys = (Array.isArray(roleKeys) && roleKeys.length
    ? roleKeys
    : Object.keys(tracks || {})
  )
    .map((key) => String(key || '').trim().toLowerCase())
    .filter(Boolean);

  const submitted = keys
    .map((roleKey, index) => ({
      roleKey,
      track: tracks[roleKey],
      versionLabel: versionLabelForIndex(index),
      index,
    }))
    .filter((row) => String(row.track?.status || '') === 'submitted');

  const byLogicalId = new Map();

  for (const row of submitted) {
    for (const { logicalId, decision } of decisionEntries(row.track?.reviewDecisions)) {
      if (!logicalId) continue;
      const side = buildSide({
        roleKey: row.roleKey,
        track: row.track,
        decision,
        versionLabel: row.versionLabel,
        decisionVersion: 1,
      });
      if (!side) continue;
      if (!byLogicalId.has(logicalId)) byLogicalId.set(logicalId, []);
      byLogicalId.get(logicalId).push({
        ...side,
        sectionKey: clip(decision?.sectionKey || inferSectionKey(logicalId), 64),
      });
    }
  }

  const builtAt = new Date().toISOString();
  const lineConflicts = [];
  const decisions = {};

  for (const [logicalId, sides] of byLogicalId.entries()) {
    const unique = [];
    const seenRole = new Set();
    for (const side of sides) {
      if (seenRole.has(side.roleKey)) continue;
      seenRole.add(side.roleKey);
      unique.push(side);
    }
    if (!unique.length) continue;

    const fingerprints = new Set(unique.map(fingerprint));
    const sectionKey = unique[0].sectionKey || inferSectionKey(logicalId);

    if (unique.length === 1 || fingerprints.size === 1) {
      decisions[logicalId] = {
        ...draftFromSide(unique[0], { source: 'auto', resolvedAt: builtAt }),
        sectionKey,
      };
      continue;
    }

    lineConflicts.push({
      id: conflictIdFor(
        logicalId,
        unique.map((side) => side.payloadHash)
      ),
      logicalId,
      sectionKey,
      status: 'open',
      sides: unique.map(
        ({
          roleKey,
          action,
          editedPayload,
          payloadHash,
          versionLabel,
          decisionVersion,
          revisionId,
          editedBy,
          submittedBy,
          editedAt,
          submittedAt,
          editorDisplayName,
        }) => ({
          roleKey,
          action,
          editedPayload,
          payloadHash,
          versionLabel,
          decisionVersion,
          revisionId,
          editedBy,
          submittedBy,
          editedAt,
          submittedAt,
          ...(editorDisplayName ? { editorDisplayName } : {}),
        })
      ),
      chosenRoleKey: null,
      chosenVersionLabel: null,
      resolvedBy: null,
      resolvedAt: null,
    });
  }

  return {
    lineConflicts,
    synthesisDraft: {
      decisions,
      builtAt,
      builtBy: 'system',
    },
  };
}

function openLineConflictCount(list) {
  return (Array.isArray(list) ? list : []).filter(
    (row) => String(row?.status || '') === 'open'
  ).length;
}

function ensureLineConflictSeed(gate2, { roleKeys = null } = {}) {
  const current = gate2 && typeof gate2 === 'object' ? gate2 : {};
  const existing = Array.isArray(current.lineConflicts) ? current.lineConflicts : null;
  const draft = current.synthesisDraft && typeof current.synthesisDraft === 'object'
    ? current.synthesisDraft
    : null;
  if (existing && draft) {
    return {
      lineConflicts: existing.map((row) => ({ ...row, sides: Array.isArray(row.sides) ? [...row.sides] : [] })),
      synthesisDraft: {
        ...draft,
        decisions:
          draft.decisions && typeof draft.decisions === 'object' ? { ...draft.decisions } : {},
      },
    };
  }
  const planKeys =
    roleKeys ||
    (current.reviewPlan
      ? require('./gate2RolePlan').roleKeysOfTracks(current.reviewPlan, current.tracks)
      : null);
  return buildLineConflictsFromTracks({ tracks: current.tracks || {}, roleKeys: planKeys });
}

/**
 * Resolve one open conflict by choosing a side role.
 * @returns {{ lineConflicts, synthesisDraft, chosenSide, rejectedSides, notifyLineRejected }}
 */
function resolveLineConflict({
  lineConflicts = [],
  synthesisDraft = null,
  conflictId = '',
  chosenRoleKey = '',
  userId = '',
  note = '',
} = {}) {
  const id = clip(conflictId, 160);
  const chosen = clip(chosenRoleKey, 64).toLowerCase();
  const actor = clip(userId, 80);
  const list = (Array.isArray(lineConflicts) ? lineConflicts : []).map((row) => ({
    ...row,
    sides: Array.isArray(row.sides) ? row.sides.map((side) => ({ ...side })) : [],
  }));
  const row = list.find((item) => String(item.id) === id);
  if (!row) {
    const err = new Error('Không thấy conflict dòng.');
    err.statusCode = 404;
    err.errorCode = 'GATE2_LINE_CONFLICT_NOT_FOUND';
    throw err;
  }
  if (String(row.status || '') !== 'open') {
    const err = new Error('Conflict dòng đã được chốt.');
    err.statusCode = 409;
    err.errorCode = 'GATE2_LINE_CONFLICT_STATE';
    throw err;
  }
  const side = row.sides.find((item) => String(item.roleKey) === chosen);
  if (!side) {
    const err = new Error('Vai trò được chọn không thuộc conflict này.');
    err.statusCode = 400;
    err.errorCode = 'GATE2_LINE_CONFLICT_SIDE';
    throw err;
  }
  if (!hasAudit(side)) {
    const err = new Error('Side thiếu audit phiên bản / người sửa — không thể chọn.');
    err.statusCode = 409;
    err.errorCode = 'GATE2_LINE_CONFLICT_AUDIT';
    throw err;
  }

  const resolvedAt = new Date().toISOString();
  row.status = 'resolved';
  row.chosenRoleKey = side.roleKey;
  row.chosenVersionLabel = side.versionLabel;
  row.resolvedBy = actor;
  row.resolvedAt = resolvedAt;
  if (note) row.resolveNote = clip(note, 2000);

  const draft = {
    ...(synthesisDraft && typeof synthesisDraft === 'object' ? synthesisDraft : {}),
    decisions: {
      ...(synthesisDraft?.decisions && typeof synthesisDraft.decisions === 'object'
        ? synthesisDraft.decisions
        : {}),
    },
  };
  draft.decisions[row.logicalId] = {
    ...draftFromSide(side, {
      source: `chosen:${side.roleKey}`,
      resolvedBy: actor,
      resolvedAt,
    }),
    sectionKey: row.sectionKey || inferSectionKey(row.logicalId),
  };
  draft.builtAt = draft.builtAt || resolvedAt;
  draft.builtBy = actor || draft.builtBy || 'system';

  const rejectedSides = row.sides.filter((item) => String(item.roleKey) !== side.roleKey);
  const notifyLineRejected = rejectedSides
    .filter((item) => hasAudit(item))
    .map((item) => ({
      userId: item.submittedBy || item.editedBy,
      kind: 'ai_hitl_gate2_line_rejected',
      title: 'Gate 2 — dòng review bị từ chối khi tổng hợp',
      content: `Dòng ${row.logicalId} (bản ${item.versionLabel}) không được chọn vào bản tổng hợp. Bản được chọn: ${side.versionLabel}.`,
      data: {
        logicalId: row.logicalId,
        sectionKey: row.sectionKey || '',
        conflictId: row.id,
        rejectedVersionLabel: item.versionLabel,
        chosenVersionLabel: side.versionLabel,
        rejectedEditedBy: item.editedBy || item.submittedBy,
        chosenEditedBy: side.editedBy || side.submittedBy,
        kind: 'ai_hitl_gate2_line_rejected',
      },
    }));

  return {
    lineConflicts: list,
    synthesisDraft: draft,
    chosenSide: side,
    rejectedSides,
    notifyLineRejected,
  };
}

module.exports = {
  stableHash,
  stableStringify,
  inferSectionKey,
  hasAudit,
  buildSide,
  buildLineConflictsFromTracks,
  openLineConflictCount,
  ensureLineConflictSeed,
  resolveLineConflict,
  draftFromSide,
  draftBaseline,
};
