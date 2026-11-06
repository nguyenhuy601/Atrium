/**
 * Prompt-only WBS chunk semantic adapter (wbs-chunk-semantic-v1).
 * Layer1 chunk-local · Layer2 evidence-gated shared · Layer3 excludes global layer.
 * Does not mutate WHAT Semantic SoT / buildWbsSemanticFromStories.
 */

const WBS_CHUNK_SEMANTIC_VERSION = 'wbs-chunk-semantic-v1';

const SUMMARY_MAX = 500;
const SUMMARY_TRIM_MAX = 180;
const RULE_MAX = 240;
const RULE_CAP = 8;
const DATA_MAX = 400;
const DATA_CAP = 8;
const CONSTRAINT_CAP = 8;
const AC_CHARS = 360;
const AC_CAP = 24;
const SHARED_GROUP_CAP = 8;

function normalizeRef(raw) {
  return String(raw || '').trim();
}

function clip(value, max) {
  const t = String(value ?? '').trim();
  if (!max || t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function normalizeKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateWbsPromptTokens(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return Math.ceil(value.length / 4);
  try {
    return Math.ceil(JSON.stringify(value).length / 4);
  } catch {
    return 0;
  }
}

function storyFrIds(story) {
  if (Array.isArray(story?.fr)) return story.fr.map(normalizeRef).filter(Boolean);
  if (Array.isArray(story?.sourceFrIds)) {
    return story.sourceFrIds.map(normalizeRef).filter(Boolean);
  }
  return [];
}

/**
 * Bước 1 — scope từ frUnits slice + stories that cite those FRs.
 * Never invent FR from story title when cites are missing.
 */
function resolveChunkScope({ frUnits = [], stories = [], allStories = null } = {}) {
  const storyPool = Array.isArray(allStories) && allStories.length ? allStories : stories;
  const frIds = [];
  const seenFr = new Set();
  for (const unit of Array.isArray(frUnits) ? frUnits : []) {
    const id = normalizeRef(unit?.id);
    if (!id || seenFr.has(id)) continue;
    seenFr.add(id);
    frIds.push(id);
  }
  const chunkFr = new Set(frIds);
  const storyIds = [];
  const seenStory = new Set();
  for (const story of Array.isArray(storyPool) ? storyPool : []) {
    const id = normalizeRef(story?.id);
    if (!id || seenStory.has(id)) continue;
    const cites = storyFrIds(story);
    if (!cites.length || !cites.some((fr) => chunkFr.has(fr))) continue;
    seenStory.add(id);
    storyIds.push(id);
  }
  return { storyIds, frIds, chunkFr };
}

/**
 * Stories that cite at least one FR in the chunk (for work-unit slim + prompt).
 */
function filterStoriesForChunkFr(stories = [], frUnits = []) {
  const chunkFr = new Set(
    (Array.isArray(frUnits) ? frUnits : []).map((u) => normalizeRef(u?.id)).filter(Boolean)
  );
  if (!chunkFr.size) return [];
  return (Array.isArray(stories) ? stories : []).filter((story) =>
    storyFrIds(story).some((id) => chunkFr.has(id))
  );
}

function pushUniqueText(list, text, maxLen, cap) {
  const clipped = clip(text, maxLen);
  if (!clipped) return;
  const key = normalizeKey(clipped);
  if (!key) return;
  if (list.some((item) => normalizeKey(item) === key)) return;
  if (list.length >= cap) return;
  list.push(clipped);
}

function relatedDataTexts(raw) {
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return String(item.name || item.entity || item.id || item.text || JSON.stringify(item));
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'object') {
    if (Array.isArray(raw.entities)) return relatedDataTexts(raw.entities);
    return [JSON.stringify(raw)];
  }
  return [String(raw)];
}

function collectEntityKeysFromRelated(raw) {
  const keys = new Set();
  if (raw == null) return keys;
  if (typeof raw === 'string') {
    const t = normalizeKey(raw);
    if (t) keys.add(t);
    return keys;
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const t = normalizeKey(item);
        if (t) keys.add(t);
      } else if (item && typeof item === 'object') {
        for (const field of ['id', 'entity', 'entityId', 'name', 'key']) {
          const t = normalizeKey(item[field]);
          if (t) keys.add(t);
        }
      }
    }
    return keys;
  }
  if (typeof raw === 'object') {
    for (const field of ['id', 'entity', 'entityId', 'name', 'key']) {
      const t = normalizeKey(raw[field]);
      if (t) keys.add(t);
    }
    if (Array.isArray(raw.entities)) {
      for (const k of collectEntityKeysFromRelated(raw.entities)) keys.add(k);
    }
  }
  return keys;
}

function extractAcLines(row) {
  const sources = [];
  if (Array.isArray(row?.ac)) sources.push(...row.ac);
  else if (Array.isArray(row?.acRefs)) sources.push(...row.acRefs);
  else if (Array.isArray(row?.acceptanceCriteria)) sources.push(...row.acceptanceCriteria);
  else if (typeof row?.acceptanceCriteria === 'string' && row.acceptanceCriteria.trim()) {
    sources.push(
      ...row.acceptanceCriteria.split(/\n|;/).map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
    );
  }
  const out = [];
  for (const item of sources) {
    const text =
      typeof item === 'string'
        ? item
        : String(item?.text || item?.statement || item?.description || '');
    pushUniqueText(out, text, AC_CHARS, AC_CAP);
  }
  return out;
}

function extractBusinessRules(unit, facts) {
  const rules = [];
  if (Array.isArray(unit?.businessRules)) {
    for (const rule of unit.businessRules) pushUniqueText(rules, rule, RULE_MAX, RULE_CAP);
  }
  if (facts?.businessRule) pushUniqueText(rules, facts.businessRule, RULE_MAX, RULE_CAP);
  if (Array.isArray(facts?.rules)) {
    for (const rule of facts.rules) {
      pushUniqueText(rules, rule?.text || rule, RULE_MAX, RULE_CAP);
    }
  }
  if (Array.isArray(facts?.businessRules)) {
    for (const rule of facts.businessRules) {
      pushUniqueText(rules, rule?.text || rule, RULE_MAX, RULE_CAP);
    }
  }
  return rules;
}

function extractTechnicalConstraints(unit, facts) {
  const out = [];
  const sources = [
    ...(Array.isArray(unit?.technicalConstraints) ? unit.technicalConstraints : []),
    ...(Array.isArray(facts?.technicalConstraints) ? facts.technicalConstraints : []),
    ...(Array.isArray(facts?.constraints) ? facts.constraints : []),
  ];
  for (const item of sources) {
    pushUniqueText(out, item?.text || item, RULE_MAX, CONSTRAINT_CAP);
  }
  return out;
}

function extractIntegrations(facts) {
  const out = [];
  const raw = facts?.integrations || facts?.integration || facts?.interfaces;
  if (!raw) return out;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    pushUniqueText(
      out,
      typeof item === 'string' ? item : item?.name || item?.id || JSON.stringify(item),
      RULE_MAX,
      SHARED_GROUP_CAP
    );
  }
  return out;
}

function explicitLinkedFrIds(facts) {
  const ids = [];
  for (const key of ['linkedFrIds', 'relatedFrIds', 'dependsOnFrIds', 'relatedFr']) {
    const raw = facts?.[key];
    if (!Array.isArray(raw)) continue;
    for (const id of raw) {
      const n = normalizeRef(id);
      if (n) ids.push(n);
    }
  }
  return ids;
}

/**
 * Bước 2 — Layer1 requirement row for one FR (approved.fr + unit only; no layer.requiredData).
 */
function extractFrRequirement(unit, facts = {}) {
  const frId = normalizeRef(unit?.id || facts?.id);
  const summaryParts = [
    facts.statement || unit?.statement || '',
    facts.capability || '',
    facts.intent || '',
    unit?.description || '',
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const semanticSummary = clip(summaryParts.join(' — '), SUMMARY_MAX);
  const dataRequirements = [];
  for (const text of relatedDataTexts(facts.relatedData || unit?.relatedData)) {
    pushUniqueText(dataRequirements, text, DATA_MAX, DATA_CAP);
  }
  const acceptanceCriteria = extractAcLines(
    unit?.ac?.length || unit?.acRefs?.length ? unit : facts.ac?.length ? facts : unit
  );
  if (!acceptanceCriteria.length) {
    for (const line of extractAcLines(facts)) pushUniqueText(acceptanceCriteria, line, AC_CHARS, AC_CAP);
  }
  return {
    frId,
    semanticSummary: semanticSummary || clip(unit?.name || frId, SUMMARY_MAX),
    businessRules: extractBusinessRules(unit, facts),
    dataRequirements,
    technicalConstraints: extractTechnicalConstraints(unit, facts),
    acceptanceCriteria,
  };
}

function indexApprovedFr(semantic) {
  const map = new Map();
  for (const row of Array.isArray(semantic?.approved?.fr) ? semantic.approved.fr : []) {
    const id = normalizeRef(row?.id);
    if (id) map.set(id, row);
  }
  return map;
}

function collectChunkEntityKeys(requirements = []) {
  const keys = new Set();
  for (const req of requirements) {
    for (const text of req.dataRequirements || []) {
      const k = normalizeKey(text);
      if (k) keys.add(k);
      // Also split simple "Entity: User" / "User entity" tokens
      for (const part of String(text).split(/[,;|/]/)) {
        const p = normalizeKey(part);
        if (p.length >= 3) keys.add(p);
      }
    }
  }
  return keys;
}

function entityOverlap(row, chunkEntityKeys) {
  if (!chunkEntityKeys.size) return false;
  const keys = collectEntityKeysFromRelated(row?.relatedData);
  for (const k of keys) {
    if (chunkEntityKeys.has(k)) return true;
    for (const chunkKey of chunkEntityKeys) {
      if (chunkKey.includes(k) || k.includes(chunkKey)) return true;
    }
  }
  return false;
}

function emptySharedContext() {
  return {
    entities: [],
    businessRules: [],
    integrations: [],
    constraints: [],
  };
}

/**
 * Bước 3 — Layer2 only with relation evidence (not same module/feature alone).
 */
function resolveSharedContext({
  approvedById,
  chunkFr,
  requirements,
} = {}) {
  const shared = emptySharedContext();
  const chunkEntityKeys = collectChunkEntityKeys(requirements);
  const requirementRuleKeys = new Set();
  for (const req of requirements || []) {
    for (const rule of req.businessRules || []) requirementRuleKeys.add(normalizeKey(rule));
  }

  for (const [frId, row] of approvedById || []) {
    if (chunkFr.has(frId)) continue;

    const linked = explicitLinkedFrIds(row);
    const hasExplicitLink = linked.some((id) => chunkFr.has(id));
    const hasEntity = entityOverlap(row, chunkEntityKeys);
    if (!hasExplicitLink && !hasEntity) continue;

    for (const k of collectEntityKeysFromRelated(row.relatedData)) {
      pushUniqueText(shared.entities, k, RULE_MAX, SHARED_GROUP_CAP);
    }
    for (const rule of extractBusinessRules({}, row)) {
      const key = normalizeKey(rule);
      if (requirementRuleKeys.has(key)) continue;
      pushUniqueText(shared.businessRules, rule, RULE_MAX, SHARED_GROUP_CAP);
    }
    for (const integ of extractIntegrations(row)) {
      pushUniqueText(shared.integrations, integ, RULE_MAX, SHARED_GROUP_CAP);
    }
    for (const c of extractTechnicalConstraints({}, row)) {
      pushUniqueText(shared.constraints, c, RULE_MAX, SHARED_GROUP_CAP);
    }
  }
  return shared;
}

/**
 * Bước 4 — drop shared items already present on Layer1 requirements.
 */
function dedupeEvidence(chunkSemantic) {
  const reqRuleKeys = new Set();
  const reqDataKeys = new Set();
  const reqConstraintKeys = new Set();
  for (const req of chunkSemantic.requirements || []) {
    for (const r of req.businessRules || []) reqRuleKeys.add(normalizeKey(r));
    for (const d of req.dataRequirements || []) reqDataKeys.add(normalizeKey(d));
    for (const c of req.technicalConstraints || []) reqConstraintKeys.add(normalizeKey(c));
  }
  const shared = chunkSemantic.sharedContext || emptySharedContext();
  return {
    ...chunkSemantic,
    sharedContext: {
      entities: (shared.entities || []).filter((e) => !reqDataKeys.has(normalizeKey(e))),
      businessRules: (shared.businessRules || []).filter((r) => !reqRuleKeys.has(normalizeKey(r))),
      integrations: shared.integrations || [],
      constraints: (shared.constraints || []).filter(
        (c) => !reqConstraintKeys.has(normalizeKey(c))
      ),
    },
  };
}

function buildWbsChunkSemantic({
  semantic = null,
  frUnits = [],
  stories = [],
  chunkStories = null,
  allStories = null,
} = {}) {
  const storyList =
    Array.isArray(chunkStories) && chunkStories.length
      ? chunkStories
      : Array.isArray(allStories) && allStories.length
        ? allStories
        : stories;
  const { storyIds, frIds, chunkFr } = resolveChunkScope({
    frUnits,
    stories: storyList,
    allStories: storyList,
  });
  const approvedById = indexApprovedFr(semantic);
  const unitById = new Map();
  for (const unit of Array.isArray(frUnits) ? frUnits : []) {
    const id = normalizeRef(unit?.id);
    if (id) unitById.set(id, unit);
  }

  const requirements = [];
  for (const frId of frIds) {
    const unit = unitById.get(frId) || { id: frId };
    const facts = approvedById.get(frId) || {};
    requirements.push(extractFrRequirement(unit, facts));
  }

  let sharedContext = resolveSharedContext({
    approvedById,
    chunkFr,
    requirements,
  });

  let out = {
    version: WBS_CHUNK_SEMANTIC_VERSION,
    scope: { storyIds, frIds },
    requirements,
    sharedContext,
  };
  out = dedupeEvidence(out);
  return out;
}

/**
 * Budget cascade on chunk semantic (never strips AC / businessRules on requirements).
 * Order: clear shared gradually → shorten semanticSummary → clear shared entirely.
 * @returns {{ chunkSemantic: object, steps: string[] }}
 */
function trimChunkSemanticToBudget(chunkSemantic, opts = {}) {
  const budget = Number(opts.budget) > 0 ? Math.round(Number(opts.budget)) : 12000;
  const buildPrompt = typeof opts.buildPrompt === 'function' ? opts.buildPrompt : null;
  const steps = [];

  let current = structuredClone
    ? structuredClone(chunkSemantic)
    : JSON.parse(JSON.stringify(chunkSemantic));

  function tokens() {
    if (buildPrompt) return estimateWbsPromptTokens(buildPrompt(current));
    return estimateWbsPromptTokens(current);
  }

  if (tokens() <= budget) return { chunkSemantic: current, steps };

  // 1) Drop shared integrations / constraints / entities / rules in that order
  const sharedOrder = ['integrations', 'constraints', 'entities', 'businessRules'];
  for (const key of sharedOrder) {
    if (tokens() <= budget) break;
    if (current.sharedContext?.[key]?.length) {
      current.sharedContext[key] = [];
      steps.push(`drop_shared_${key}`);
    }
  }

  // 2) Dedupe again (no-op if already clean)
  current = dedupeEvidence(current);
  steps.push('dedupe');

  // 3) Shorten semanticSummary only — keep businessRules + acceptanceCriteria
  if (tokens() > budget) {
    for (const req of current.requirements || []) {
      if (req.semanticSummary && req.semanticSummary.length > SUMMARY_TRIM_MAX) {
        req.semanticSummary = clip(req.semanticSummary, SUMMARY_TRIM_MAX);
      }
    }
    steps.push('clip_semanticSummary');
  }

  // 4) Clear remaining shared
  if (tokens() > budget) {
    current.sharedContext = emptySharedContext();
    steps.push('clear_sharedContext');
  }

  return { chunkSemantic: current, steps };
}

module.exports = {
  WBS_CHUNK_SEMANTIC_VERSION,
  estimateWbsPromptTokens,
  resolveChunkScope,
  filterStoriesForChunkFr,
  extractFrRequirement,
  resolveSharedContext,
  dedupeEvidence,
  buildWbsChunkSemantic,
  trimChunkSemanticToBudget,
  emptySharedContext,
};
