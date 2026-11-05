/**
 * Gate 2 copy theo gateReviewPolicy / reviewPlan — không hardcode PM/PO.
 */

const LEGACY_SHORT = Object.freeze({
  po: 'PO',
  tech: 'Tech Lead',
  pm: 'PM',
  product_owner: 'PO',
  tech_lead: 'Tech Lead',
  project_manager: 'PM',
  business_analyst: 'BA',
  qa: 'QA',
  tester: 'Tester',
  technical_lead: 'Tech Lead',
  productowner: 'PO',
  projectmanager: 'PM',
  businessanalyst: 'BA',
  solution_architect: 'Kiến trúc sư giải pháp',
  solutionarchitect: 'Kiến trúc sư giải pháp',
  architect: 'Kiến trúc sư giải pháp',
});

function cleanKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function labelOf(t, key, fallback, vars) {
  const value = typeof t === 'function' ? t(key, vars) : '';
  if (value && value !== key) return value;
  if (!vars) return fallback;
  return Object.entries(vars).reduce(
    (text, [name, raw]) => text.replace(`{${name}}`, String(raw ?? '')),
    fallback
  );
}

/** Nhãn ngắn cho role key (PO / PM / BA…). */
export function shortGate2RoleLabel(roleKey, _t) {
  const key = cleanKey(roleKey);
  if (!key) return '';
  if (LEGACY_SHORT[key]) return LEGACY_SHORT[key];
  // PRODUCT_OWNER / PROJECT_MANAGER (catalog uppercase)
  const compact = key.replace(/_/g, '');
  if (LEGACY_SHORT[compact]) return LEGACY_SHORT[compact];
  return String(roleKey || key).trim();
}

export function joinRoleLabels(roleKeys, t) {
  const labels = (roleKeys || []).map((key) => shortGate2RoleLabel(key, t)).filter(Boolean);
  if (!labels.length) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} · ${labels[labels.length - 1]}`;
}

/** Vai trò bắt đầu Gate 2 sau khi HOW ready. */
export function firstGate2ActorKeys(reviewPlan) {
  const plan = reviewPlan && typeof reviewPlan === 'object' ? reviewPlan : null;
  const finalKey = cleanKey(plan?.finalRoleKey);
  if (!finalKey) return ['pm'];
  const mode = String(plan.mode || '').trim().toLowerCase();
  if (mode === 'single') return [finalKey];
  if (mode === 'sequential') {
    const order = Array.isArray(plan.order) ? plan.order.map(cleanKey).filter(Boolean) : [];
    const first = order.find((key) => key && key !== finalKey);
    return first ? [first] : [finalKey];
  }
  const parallel = Array.isArray(plan.parallelRoleKeys)
    ? plan.parallelRoleKeys.map(cleanKey).filter(Boolean)
    : [];
  return parallel.length ? parallel : [finalKey];
}

export function resolveGate2CopyRoles(reviewPlan, t) {
  const plan = reviewPlan && typeof reviewPlan === 'object' ? reviewPlan : null;
  const hasPlan = Boolean(cleanKey(plan?.finalRoleKey));
  const synthesisKey = hasPlan
    ? cleanKey(plan.synthesisRoleKey) || cleanKey(plan.finalRoleKey)
    : 'pm';
  const finalKey = hasPlan ? cleanKey(plan.finalRoleKey) : 'po';
  const actorKeys = firstGate2ActorKeys(hasPlan ? plan : null);
  return {
    hasPlan,
    synthesisKey,
    finalKey,
    actorKeys,
    synthesis: shortGate2RoleLabel(synthesisKey, t) || 'PM',
    final: shortGate2RoleLabel(finalKey, t) || 'PO',
    actors: joinRoleLabels(actorKeys, t) || 'PM',
  };
}

/**
 * @returns {string|null} message for waiting lanes; null if caller should render decide UI
 */
export function resolveGate2WaitingMessage({ reviewView, reviewPlan, t }) {
  const view = String(reviewView || '').trim();
  const roles = resolveGate2CopyRoles(reviewPlan, t);
  const vars = { synthesis: roles.synthesis, final: roles.final, actors: roles.actors };

  if (view === 'howPending') {
    return labelOf(
      t,
      'requirements.gate2HowPending',
      'Vai trò đã gán: {actors}. Chưa có bảng duyệt vì AI Planning (HOW) chưa xong — chạy/theo dõi HOW trên tab Monitor. Khi HOW ready, bảng Gate 2 hiện tại đây.',
      vars
    );
  }
  if (view === 'waitingParallel' || view === 'waitingPm' || view === 'waitingTech') {
    return labelOf(
      t,
      'requirements.gate2WaitingParallel',
      'Đang chờ các vai trò đã chọn review toàn bộ kế hoạch.',
      vars
    );
  }
  if (view === 'waitingConsolidation') {
    return labelOf(
      t,
      'requirements.gate2WaitingConsolidation',
      'Đã đủ review. Chờ {synthesis} tổng hợp rồi gửi {final} xác nhận cuối.',
      vars
    );
  }
  if (view === 'waitingPo') {
    return labelOf(
      t,
      'requirements.gate2WaitingPo',
      '{synthesis} đã gửi bản tổng hợp. Chờ {final} xác nhận cuối Gate 2.',
      vars
    );
  }
  return null;
}

export default resolveGate2WaitingMessage;
