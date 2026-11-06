/**
 * Build a minimal shell-shaped object from granular REST resources
 * so existing companySpaceLevel / overview helpers keep working.
 */

/**
 * Rebuild nested branches from flat nav adjacency list.
 * @param {Array<{ id: string, name: string, type: string, parentId: string|null, headId?: string|null, leaderId?: string|null }>} nodes
 */
export function navNodesToBranches(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byId = new Map(list.map((n) => [String(n.id), { ...n, children: [] }]));
  const roots = [];

  for (const n of byId.values()) {
    const parentId = n.parentId != null ? String(n.parentId) : '';
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(n);
    } else if (n.type === 'branch' || !parentId) {
      roots.push(n);
    }
  }

  const toTeam = (n) => ({
    _id: n.id,
    id: n.id,
    name: n.name,
    leader: n.leaderId || null,
  });
  const toDept = (n) => ({
    _id: n.id,
    id: n.id,
    name: n.name,
    head: n.headId || null,
    teams: (n.children || []).filter((c) => c.type === 'team').map(toTeam),
  });
  const toDivision = (n) => ({
    _id: n.id,
    id: n.id,
    name: n.name,
    departments: (n.children || []).filter((c) => c.type === 'department').map(toDept),
  });
  const toBranch = (n) => ({
    _id: n.id,
    id: n.id,
    name: n.name,
    divisions: (n.children || []).filter((c) => c.type === 'division').map(toDivision),
  });

  const branches = roots.filter((r) => r.type === 'branch').map(toBranch);
  if (branches.length) return branches;

  // Orphan departments/divisions without branch — wrap in synthetic branch
  const divisions = roots.filter((r) => r.type === 'division').map(toDivision);
  const departments = roots.filter((r) => r.type === 'department').map(toDept);
  if (!divisions.length && !departments.length) return [];
  return [
    {
      _id: 'synthetic-root',
      id: 'synthetic-root',
      name: '',
      divisions: divisions.length
        ? divisions
        : [{ _id: 'synthetic-div', id: 'synthetic-div', name: '', departments }],
    },
  ];
}

/**
 * @param {{ profile?: object|null, structureNav?: Array|null, structureFull?: object|null, access?: object|null, taskWorkspaceScope?: object|null, badges?: object|null }} args
 */
export function toShellCompat({
  profile = null,
  structureNav = null,
  structureFull = null,
  access = null,
  taskWorkspaceScope = null,
  badges = null,
} = {}) {
  const scope = profile?.scope || access?.scope || {};
  const structureSummary =
    structureFull ||
    (Array.isArray(structureNav)
      ? { branches: navNodesToBranches(structureNav) }
      : null);

  const organization = {
    id: profile?.organization?.id || '',
    name: profile?.organization?.name || '',
    slug: profile?.organization?.slug || '',
    icon: profile?.organization?.icon ?? null,
    myRole: profile?.myRole ?? null,
    myOrganizationRoles: Array.isArray(profile?.myOrganizationRoles)
      ? profile.myOrganizationRoles
      : [],
    myPosition: profile?.myPosition ?? null,
  };

  return {
    organization,
    structureSummary,
    access: {
      channelIds: access?.channelIds || [],
      permissionsByChannelId: access?.permissionsByChannelId || {},
      projectChannels: access?.projectChannels || [],
      scope,
      memberReady:
        profile?.memberReady != null
          ? Boolean(profile.memberReady)
          : Boolean(access?.memberReady),
      memberReadyCode:
        profile?.memberReadyCode != null
          ? profile.memberReadyCode
          : access?.memberReadyCode ?? null,
    },
    taskWorkspaceScope: taskWorkspaceScope || null,
    badges: badges || {},
    shellVersion: profile?.shellVersion,
    placement: profile?.placement || null,
  };
}
