/** Fail-closed when capabilities missing on project row. */
export function normalizeProjectCapabilities(capabilities) {
  return capabilities != null && typeof capabilities === 'object' ? capabilities : {};
}

export function canEnterProjectSettings(capabilities) {
  const c = normalizeProjectCapabilities(capabilities);
  return (
    Boolean(c.canViewSettings) ||
    Boolean(c.canManageSettings) ||
    Boolean(c.canManageProjectRoles)
  );
}

const ANALYSIS_VIEW_MODULES = new Set([
  'customer-documents',
  'analysis-bg',
  'analysis-br',
  'analysis-bpm',
  'analysis-fr',
  'analysis-uc',
  'analysis-nfr',
  'analysis-scope',
  'analysis-interface',
  'analysis-data',
  'analysis-glossary',
  'analysis-assumption',
  'traceability',
  'analysis-reviews',
  'srs-baselines',
]);

const WORK_ITEM_MODULES = new Set([
  'list',
  'board',
  'timeline',
  'execution-control',
  'test-cases',
]);

const RELEASE_MODULES = new Set([
  'handover',
  'deploy-evidence',
  'release-notes',
  'acceptance',
]);

function permList(caps) {
  return Array.isArray(caps.permissions) ? caps.permissions : [];
}

function hasPerm(caps, key) {
  return permList(caps).includes(key);
}

function canViewProject(caps) {
  if (caps.canView != null) return Boolean(caps.canView);
  return hasPerm(caps, 'project:view');
}

/**
 * Quyền xem module (nav + route + mount UI/data).
 *
 * - Không có quyền view → không thấy chức năng trên nav, không vào route, không mount dữ liệu.
 * - Có quyền view → được xem dữ liệu theo quyền đó.
 * - Thao tác sửa/xóa/duyệt → chỉ khi có canEdit / canManage (nút + API), không thay thế view gate.
 *
 * @param {string} moduleKey
 * @param {object|null|undefined} capabilities
 * @returns {boolean}
 */
export function canAccessProjectModule(moduleKey, capabilities) {
  const caps = normalizeProjectCapabilities(capabilities);
  const mod = String(moduleKey || '')
    .trim()
    .toLowerCase();
  if (!mod) return false;

  if (mod === 'overview') return canViewProject(caps);

  if (mod === 'settings') return canEnterProjectSettings(caps);
  if (mod === 'delivery-phase') {
    return (
      Boolean(caps.canChangeDeliveryPhase) ||
      hasPerm(caps, 'delivery_phase:change') ||
      Boolean(caps.canSignOffUat) ||
      hasPerm(caps, 'uat:sign_off') ||
      Boolean(caps.canAcceptHandover) ||
      hasPerm(caps, 'handover:accept')
    );
  }
  if (mod === 'reports') return Boolean(caps.canViewReport) || hasPerm(caps, 'report:view');
  if (mod === 'members') return Boolean(caps.canViewMembers) || hasPerm(caps, 'members:view');
  if (mod === 'files') return Boolean(caps.canViewFiles) || hasPerm(caps, 'files:view');
  if (mod === 'activity') {
    return Boolean(caps.canViewActivityTab) || hasPerm(caps, 'activity:view');
  }
  if (mod === 'change-requests') {
    return Boolean(caps.canViewChangeRequests) || hasPerm(caps, 'change_request:view');
  }

  if (WORK_ITEM_MODULES.has(mod)) {
    return Boolean(caps.canViewWorkItems) || hasPerm(caps, 'task:view');
  }

  // Hub backlog tab (khác planning/* phase 1)
  if (mod === 'planning') {
    return (
      Boolean(caps.canViewBacklog) ||
      hasPerm(caps, 'backlog:view') ||
      Boolean(caps.canViewPlanning) ||
      hasPerm(caps, 'planning:view')
    );
  }

  // Cộng tác hub: Chat cần thành viên dự án (project:view); Lịch/Tài liệu map meeting/files|wiki.
  if (mod === 'documents') {
    return (
      Boolean(caps.canViewFiles) ||
      hasPerm(caps, 'files:view') ||
      hasPerm(caps, 'wiki:view') ||
      canViewProject(caps)
    );
  }
  if (mod === 'chat') {
    return canViewProject(caps) || hasPerm(caps, 'meeting:view');
  }
  if (mod === 'calendar') {
    return hasPerm(caps, 'meeting:view') || canViewProject(caps);
  }

  if (RELEASE_MODULES.has(mod)) {
    return (
      hasPerm(caps, 'release:view') ||
      hasPerm(caps, 'delivery:view') ||
      Boolean(caps.canAcceptHandover) ||
      Boolean(caps.canSignOffUat) ||
      canViewProject(caps)
    );
  }

  if (ANALYSIS_VIEW_MODULES.has(mod) || mod === 'ai-hitl') {
    return Boolean(caps.canViewAnalysis) || hasPerm(caps, 'analysis:view');
  }

  if (
    mod === 'delivery-planning' ||
    mod.startsWith('planning-') ||
    mod.startsWith('planning/')
  ) {
    return Boolean(caps.canViewPlanning) || hasPerm(caps, 'planning:view');
  }

  return canViewProject(caps);
}
