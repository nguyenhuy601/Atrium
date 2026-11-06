/**
 * Resolve requirement pack linked to a project (for AI HITL entry guards).
 * Uses list filter by projectId — no org-wide list, no view=full.
 */

import { requirementAPI } from '../../../../services/api/requirementAPI';

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res;
}

function packProjectId(pack) {
  const raw = pack?.projectId;
  if (raw && typeof raw === 'object') return String(raw._id || raw.id || '').trim();
  return String(raw || '').trim();
}

/** Shared React Query key — Sidebar / Phase1Shell / AiHitlWorkspacePage. */
export function aiHitlNavLinkedPackQueryKey(organizationId, projectId) {
  return ['aiHitlNavLinkedPack', String(organizationId || ''), String(projectId || '')];
}

export function linkedPackIdFromRow(pack) {
  return String(pack?._id || pack?.id || '').trim();
}

/**
 * @returns {Promise<object|null>} pack list row (includes overview.analysisMode) or null
 */
export async function loadLinkedPackForAiNav(organizationId, projectId) {
  const orgId = String(organizationId || '').trim();
  const pid = String(projectId || '').trim();
  if (!orgId || !pid) return null;

  const listed = unwrap(await requirementAPI.listPacks(orgId, { projectId: pid }));
  const list = Array.isArray(listed) ? listed : listed?.items || listed?.packs || [];
  const hit = list.find((pack) => packProjectId(pack) === pid) || list[0] || null;
  return hit || null;
}
