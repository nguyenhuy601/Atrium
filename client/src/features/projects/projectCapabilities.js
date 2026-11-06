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
