/**
 * Logical HOW history intents (one pipeline / one docType).
 * RULE-RAG-HOW-04: history is supplementary — never required input.
 */

const HISTORY_INTENTS = Object.freeze([
  'role_experience',
  'technology_experience',
  'domain_experience',
  'history_snippet',
]);

/**
 * @param {string} query
 * @param {{ engine?: string }} [opts]
 * @returns {'role_experience'|'technology_experience'|'domain_experience'|'history_snippet'|null}
 */
function classifyHistoryIntent(query = '', opts = {}) {
  const q = String(query || '').toLowerCase();
  const engine = String(opts.engine || '').trim().toLowerCase();

  const TECH_RE =
    /\b(mongodb|mongo|redis|typescript|python|react|nodejs|node\.?js|node|java|golang|postgres(?:ql)?|kafka|docker|kubernetes|k8s|technology|tech stack)\b/;
  const DOMAIN_RE =
    /\b(domain|industry|smart[\s_-]?city|iot|healthcare|fintech|retail|sector)\b/;

  if (engine === 'matching' || engine === 'employee_matching') {
    if (TECH_RE.test(q)) return 'technology_experience';
    if (DOMAIN_RE.test(q)) return 'domain_experience';
    if (/\b(role|developer|qa|pm|analyst|backend|frontend|devops)\b/.test(q)) {
      return 'role_experience';
    }
  }
  if (engine === 'wbs' || engine === 'effort') {
    if (/\b(tech|stack|api|schema|framework)\b/.test(q) || TECH_RE.test(q)) {
      return 'technology_experience';
    }
    if (DOMAIN_RE.test(q)) return 'domain_experience';
  }

  // Prefer technology / domain before role when both appear (e.g. "MongoDB … backend")
  if (TECH_RE.test(q)) return 'technology_experience';
  if (DOMAIN_RE.test(q)) return 'domain_experience';
  if (
    /\b(role|backend|frontend|qa|developer|analyst|devops)\b/.test(q) &&
    /\b(experience|history|kinh nghiệm|past)\b/.test(q)
  ) {
    return 'role_experience';
  }
  if (/\b(history|past project|kinh nghiệm|experience)\b/.test(q)) {
    return 'history_snippet';
  }
  return null;
}

/**
 * Metadata soft-boost for history docs (additive to text score).
 * @param {object} doc
 * @param {string} intent
 * @param {string} query
 */
function historyMetadataBoost(doc, intent, query) {
  if (!doc || doc.docType !== 'employee_history') return 0;
  const q = String(query || '').toLowerCase();
  const meta = doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};
  let boost = 0;
  const role = String(meta.role || '').toLowerCase();
  const domains = Array.isArray(meta.domain)
    ? meta.domain.map((d) => String(d || '').toLowerCase())
    : String(meta.domain || '')
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const techs = Array.isArray(meta.technologies)
    ? meta.technologies.map((t) => String(t || '').toLowerCase())
    : [];

  if (intent === 'role_experience' || intent === 'history_snippet') {
    if (role && q.includes(role)) boost += 0.25;
  }
  if (intent === 'technology_experience' || intent === 'history_snippet' || intent === 'skill_def') {
    for (const t of techs) {
      const tNorm = t.replace(/[\s_-]+/g, '');
      const qNorm = q.replace(/[\s_-]+/g, '');
      if (t.length >= 2 && (q.includes(t) || qNorm.includes(tNorm))) {
        boost += 0.3;
        break;
      }
    }
  }
  if (intent === 'domain_experience' || intent === 'history_snippet') {
    for (const d of domains) {
      const dNorm = d.replace(/[\s_-]+/g, '');
      const qNorm = q.replace(/[\s_-]+/g, '');
      if (d.length >= 2 && (q.includes(d) || qNorm.includes(dNorm) || dNorm.includes(qNorm.slice(0, 12)))) {
        boost += 0.25;
        break;
      }
    }
  }
  return boost;
}

/**
 * Map engine purpose → preferred history intent for preparePhaseRagContext callers.
 * Returns null when query is not history-oriented (preserve how_planning / skill_def / etc.).
 */
function historyIntentForEngine(engine, query) {
  const classified = classifyHistoryIntent(query, { engine });
  if (classified) return classified;
  const eng = String(engine || '').trim().toLowerCase();
  if (
    eng === 'matching' ||
    eng === 'employee_matching' ||
    eng === 'role_experience' ||
    eng === 'technology_experience' ||
    eng === 'domain_experience'
  ) {
    return 'history_snippet';
  }
  return null;
}

module.exports = {
  HISTORY_INTENTS,
  classifyHistoryIntent,
  historyMetadataBoost,
  historyIntentForEngine,
};
