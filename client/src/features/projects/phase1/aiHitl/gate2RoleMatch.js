/**
 * Khớp role key Gate 2 với membership — canonical (TECHNICAL_LEAD ↔ tech_lead).
 * Pure helper (không phụ thuộc i18n) để dùng được trong node --test.
 */

const ALIASES = Object.freeze({
  tech: 'TECHNICAL_LEAD',
  tech_lead: 'TECHNICAL_LEAD',
  technical_lead: 'TECHNICAL_LEAD',
  architect: 'SOLUTION_ARCHITECT',
  solution_architect: 'SOLUTION_ARCHITECT',
  solutionarchitect: 'SOLUTION_ARCHITECT',
  product_owner: 'PRODUCT_OWNER',
  project_manager: 'PROJECT_MANAGER',
  business_analyst: 'BUSINESS_ANALYST',
  po: 'PRODUCT_OWNER',
  pm: 'PROJECT_MANAGER',
  ba: 'BUSINESS_ANALYST',
  qa: 'QA_ENGINEER',
  tester: 'QA_ENGINEER',
});

export function canonicalGate2RoleKey(raw) {
  const lower = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (!lower) return '';
  if (ALIASES[lower]) return ALIASES[lower];
  const compact = lower.replace(/_/g, '');
  if (ALIASES[compact]) return ALIASES[compact];
  return lower.toUpperCase();
}

export function viewerHoldsGate2Role(viewerRoleKeys, requiredKey) {
  const need = canonicalGate2RoleKey(requiredKey);
  if (!need) return false;
  return (viewerRoleKeys || []).some((key) => canonicalGate2RoleKey(key) === need);
}

export function isHowReadyForGate2(howStatus) {
  const how = String(howStatus || '')
    .trim()
    .toLowerCase();
  return how === 'ready' || how === 'completed' || how === 'confirmed';
}

export function isHowInFlightForGate2(howStatus) {
  const how = String(howStatus || '')
    .trim()
    .toLowerCase();
  return ['pending', 'running', 'queued', 'waiting_human', 'waiting_external'].includes(how);
}

export default viewerHoldsGate2Role;
