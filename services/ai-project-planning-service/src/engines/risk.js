/**
 * Risk score helpers + container patch.
 * Heuristic risk catalog (high-cap / gap titles) is not a runtime path.
 */

function scoreFromPi(probability, impact) {
  return probability * impact;
}

function bandFromScore(score) {
  if (score >= 15) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

function applyRiskToContainer(container, riskResult, riskScope = null) {
  const next = {
    ...container,
    analyses: { ...(container?.analyses || {}) },
  };
  const items = (riskResult.items || riskResult.risks || []).map((item) =>
    riskScope ? { ...item, sourceScope: riskScope } : item
  );
  const record = {
    status: riskResult.status || 'ready',
    model: riskResult.model || null,
    generatedAt: riskResult.generatedAt || new Date().toISOString(),
    items,
    risks: items,
    maxSeverity: riskResult.maxSeverity ?? null,
    openQuestions: Array.isArray(riskResult.openQuestions) ? riskResult.openQuestions : [],
    entities: [],
    edges: [],
    dataFlows: [],
    orderHint: [],
    chains: [],
    meta: riskResult.meta || {},
  };
  if (riskScope === 'source' || riskScope === 'dependency') {
    next.analyses.riskByScope = {
      ...(container?.analyses?.riskByScope || {}),
      [riskScope]: record,
    };
    return next;
  }
  next.analyses.risk = record;
  return next;
}

module.exports = {
  applyRiskToContainer,
  bandFromScore,
  scoreFromPi,
};
