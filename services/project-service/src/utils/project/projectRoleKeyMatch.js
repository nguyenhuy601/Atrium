/**
 * Canonical project role key — khớp tech_lead ↔ TECHNICAL_LEAD, solution_architect ↔ …
 */

const ALIASES = Object.freeze({
  tech: 'TECHNICAL_LEAD',
  tech_lead: 'TECHNICAL_LEAD',
  technical_lead: 'TECHNICAL_LEAD',
  architect: 'SOLUTION_ARCHITECT',
  solution_architect: 'SOLUTION_ARCHITECT',
  solutionarchitect: 'SOLUTION_ARCHITECT',
  po: 'PRODUCT_OWNER',
  product_owner: 'PRODUCT_OWNER',
  pm: 'PROJECT_MANAGER',
  project_manager: 'PROJECT_MANAGER',
  ba: 'BUSINESS_ANALYST',
  business_analyst: 'BUSINESS_ANALYST',
  qa: 'QA_ENGINEER',
  tester: 'QA_ENGINEER',
});

function canonicalProjectRoleKey(raw) {
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

function roleKeysMatch(heldKeys, requiredKey) {
  const need = canonicalProjectRoleKey(requiredKey);
  if (!need) return false;
  return (heldKeys || []).some((key) => canonicalProjectRoleKey(key) === need);
}

module.exports = {
  canonicalProjectRoleKey,
  roleKeysMatch,
};
