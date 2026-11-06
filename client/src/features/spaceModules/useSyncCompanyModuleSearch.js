import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace, SPACE_KIND } from '../../context/SpaceContext';
import { buildCompanyModuleSearch } from '../../utils/companySpaceLevel';

/** Org id stays in WorkspaceContext — only dept/team/(chat)tab sync to URL. */
const SYNC_KEYS_CHAT = ['departmentId', 'teamId', 'tab'];
const SYNC_KEYS_PATH_MODULE = ['departmentId', 'teamId'];

/**
 * Keep URL query aligned with SpaceContext for OrganizationsPage hydrate.
 * organizationId is resolved from WorkspaceContext (not written to URL).
 * @param {'chat'|'documents'|'calendar'} module
 */
export function useSyncCompanyModuleSearch(module) {
  const space = useSpace();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastSyncedRef = useRef('');

  useEffect(() => {
    if (space?.kind !== SPACE_KIND.COMPANY) return;
    const deptId = String(space?.departmentId || '').trim();
    if (!deptId) return;

    const mod = String(module || '').trim().toLowerCase();
    const syncKeys = mod === 'chat' ? SYNC_KEYS_CHAT : SYNC_KEYS_PATH_MODULE;

    const desired = buildCompanyModuleSearch(space, module);
    desired.delete('organizationId');
    desired.delete('orgId');
    if (mod !== 'chat') desired.delete('tab');
    const desiredKey = desired.toString();
    const syncKey = `${module}|${desiredKey}`;
    const hasOrgQuery = Boolean(searchParams.get('organizationId') || searchParams.get('orgId'));
    const hasRedundantTab =
      mod !== 'chat' &&
      ['documents', 'calendar'].includes(String(searchParams.get('tab') || '').trim());

    if (lastSyncedRef.current === syncKey && !hasOrgQuery && !hasRedundantTab) {
      let drifted = false;
      for (const key of syncKeys) {
        const want = desired.get(key) || '';
        const have = String(searchParams.get(key) || '').trim();
        if (want !== have) {
          drifted = true;
          break;
        }
      }
      if (!drifted) return;
    }

    let changed = hasOrgQuery || hasRedundantTab;
    const next = new URLSearchParams(searchParams);
    next.delete('organizationId');
    next.delete('orgId');
    if (mod !== 'chat') next.delete('tab');
    for (const key of syncKeys) {
      const want = desired.get(key) || '';
      const have = String(next.get(key) || '').trim();
      if (want !== have) {
        if (want) next.set(key, want);
        else next.delete(key);
        changed = true;
      }
    }
    if (!changed) {
      lastSyncedRef.current = syncKey;
      return;
    }
    lastSyncedRef.current = syncKey;
    setSearchParams(next, { replace: true });
  }, [
    space?.kind,
    space?.organizationId,
    space?.departmentId,
    space?.teamId,
    space?.level,
    module,
    searchParams,
    setSearchParams,
  ]);
}
