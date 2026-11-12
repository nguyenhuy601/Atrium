import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminUserActionsMenu from '../../components/adminUsers/AdminUserActionsMenu';
import AdminUserDetailDrawer from '../../components/adminUsers/AdminUserDetailDrawer';
import {
  ADMIN_LIST_PAGE_SIZE,
  AdminDenseMobileList,
  AdminDenseTableCard,
  AdminDenseTableScroll,
  AdminListFilterPopover,
  AdminListPagination,
  AdminListSearchInput,
  AdminPillBadge,
  adminDenseRowClass,
  adminFilterSelectClass,
  adminPrimaryBtnClass,
  adminSecondaryBtnClass,
} from '../../components/adminUsers/adminUserPanelUi';
import { VH_MOTION_BTN } from '../../motion/classes';
import { useCompanyAdminContext } from '../../pages/Admin/CompanyAdminLayout';
import { organizationAPI } from '../../services/api/organizationAPI';
import { orgRbacAPI } from '../../services/api/orgRbacAPI';
import { useAppStrings } from '../../locales/appStrings';
import UserAvatar from '../../components/Shared/UserAvatar';
import useAdminMembers from '../../hooks/useAdminMembers';
import { useDebouncedValue } from '../search/useDebouncedValue';
import { normalizeRoleDisplayName } from '../../utils/adminRbacUtils';
import {
  accountRoleLabel,
  compareMembersForAdminList,
  formatRbacRoleLabels,
  memberDepartmentId,
  memberDisplayName,
  memberEmail,
  memberEmployeeCode,
  memberOrgRole,
  memberStatusKey,
  memberStatusLabel,
  memberTeamId,
  memberUserId,
} from '../../utils/adminUserUtils';
import { buildOrgRoleRowsByUserId } from '../../utils/userTaxonomyUtils';
import { adminUserHubLink } from '../../utils/adminHubLinks';
import { orgRoleCatalogAPI } from '../../services/api/orgRoleCatalogAPI';
import { useAdminActionGate } from '../../hooks/useAdminActionGate';
import { RBAC_GRANT } from '../../config/rbacUiGrantMap';

const FILTER_SELECT_CLASS = adminFilterSelectClass();

const STATUS_VARIANT = {
  active: 'success',
  locked: 'warning',
  inactive: 'muted',
  mustChangePassword: 'info',
};

const CAP_VARIANT = {
  pending_hr: 'warning',
  verified: 'success',
  rejected: 'error',
  draft: 'muted',
};

function CapabilityStatusBadge({ status, t }) {
  const key = ['pending_hr', 'verified', 'rejected'].includes(status) ? status : 'draft';
  return <AdminPillBadge variant={CAP_VARIANT[key]}>{t(`settingsCapability.status.${key}`)}</AdminPillBadge>;
}

function StatusBadge({ member, t }) {
  const key = memberStatusKey(member);
  return (
    <AdminPillBadge variant={STATUS_VARIANT[key] || 'success'}>{memberStatusLabel(member, t)}</AdminPillBadge>
  );
}

function UsersTableSkeletonRows({ rows = ADMIN_LIST_PAGE_SIZE }) {
  return Array.from({ length: rows }, (_, rowIdx) => (
    <tr key={`sk-${rowIdx}`} className="border-b border-border">
      {Array.from({ length: 8 }, (_, colIdx) => (
        <td key={colIdx} className="px-4 py-3">
          <span className="inline-block h-4 w-full max-w-[7rem] rounded bg-muted motion-safe:animate-pulse" />
        </td>
      ))}
    </tr>
  ));
}

function isSystemAdminMember(member) {
  return String(member?.systemRole || '').trim().toLowerCase() === 'admin';
}

function OrgRoleCell({ rows, emptyLabel }) {
  if (!rows?.length) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <div className="flex max-w-[180px] flex-wrap gap-1">
      {rows.map((row) => (
        <AdminPillBadge key={row.id} variant="primary" className="text-[10px]" title={row.scopeName || undefined}>
          {row.label}
        </AdminPillBadge>
      ))}
    </div>
  );
}

function PositionCell({ title, emptyLabel }) {
  const value = String(title || '').trim();
  if (!value) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <span className="max-w-[160px] truncate text-sm text-foreground" title={value}>
      {value}
    </span>
  );
}

function SortableTh({ label, columnKey, activeKey, dir, onSort }) {
  const active = activeKey === columnKey;
  return (
    <th
      className="px-4 py-3"
      aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : undefined}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VH_MOTION_BTN}`}
        onClick={() => onSort(columnKey)}
      >
        {label}
        <span className={active ? 'text-foreground' : 'opacity-40'} aria-hidden>
          {active ? (dir === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      </button>
    </th>
  );
}

/** Một org chỉ một lượt tải — effect chạy lại (StrictMode) dùng cùng promise. */
const usersListEnrichmentInflight = new Map();

function fetchUsersListEnrichment(orgId, { includeOrgRoleAssignments = true } = {}) {
  const key = String(orgId || '').trim();
  const cacheKey = `${key}:orgRole=${includeOrgRoleAssignments ? '1' : '0'}`;
  const pending = usersListEnrichmentInflight.get(cacheKey);
  if (pending) return pending;

  const task = (async () => {
    let assignmentsFailed = false;
    const [structureRes, assignRes, positionRes, positionAssignRes] = await Promise.all([
      organizationAPI.getStructure(key).catch(() => {
        assignmentsFailed = true;
        return null;
      }),
      includeOrgRoleAssignments
        ? orgRoleCatalogAPI.listAssignments(key).catch(() => null)
        : Promise.resolve(null),
      organizationAPI.listHrPositions(key).catch(() => null),
      orgRbacAPI.listAssignments(key, { status: 'active' }).catch(() => null),
    ]);
    return { structureRes, assignRes, positionRes, positionAssignRes, assignmentsFailed };
  })().finally(() => {
    if (usersListEnrichmentInflight.get(cacheKey) === task) {
      usersListEnrichmentInflight.delete(cacheKey);
    }
  });

  usersListEnrichmentInflight.set(cacheKey, task);
  return task;
}

function collectDeptTeamMaps(structure) {
  const departments = new Map();
  const teams = new Map();
  for (const branch of structure?.branches || []) {
    for (const division of branch?.divisions || []) {
      for (const department of division?.departments || []) {
        const did = String(department._id || department.id || '');
        if (did) departments.set(did, department.name || did);
        for (const team of department?.teams || []) {
          const tid = String(team._id || team.id || '');
          if (tid) teams.set(tid, team.name || tid);
        }
      }
    }
  }
  for (const department of structure?.departments || []) {
    const did = String(department._id || department.id || '');
    if (did) departments.set(did, department.name || did);
    for (const team of department?.teams || []) {
      const tid = String(team._id || team.id || '');
      if (tid) teams.set(tid, team.name || tid);
    }
  }
  return { departments, teams };
}

export default function UsersListPanel({ orgId }) {
  const { t, locale } = useAppStrings();
  const tRef = useRef(t);
  tRef.current = t;
  const navigate = useNavigate();
  const { organization } = useCompanyAdminContext();
  const { can, grantsLoading } = useAdminActionGate(orgId);
  const canViewOrgRoleAssignments = can(RBAC_GRANT.ORG_ROLE_VIEW);
  const canInvite = can(RBAC_GRANT.EMPLOYEE_INVITE);
  const canDeleteEmployee = can(RBAC_GRANT.EMPLOYEE_DELETE);
  const { members, loading, error: membersError, loadMembers } = useAdminMembers(orgId, {
    view: 'admin_table',
  });

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ADMIN_LIST_PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [structureMaps, setStructureMaps] = useState({ departments: new Map(), teams: new Map() });
  const [structureLoadFailed, setStructureLoadFailed] = useState(false);
  const [structureReloadKey, setStructureReloadKey] = useState(0);
  const [orgRoleByUser, setOrgRoleByUser] = useState({});
  const [positionByUser, setPositionByUser] = useState({});
  const [capabilityOverrides, setCapabilityOverrides] = useState({});
  const [detailMember, setDetailMember] = useState(null);

  const rbacByUser = useMemo(() => {
    const map = {};
    for (const m of members) {
      const id = memberUserId(m);
      if (id) map[id] = Array.isArray(m.rbacRoles) ? m.rbacRoles : [];
    }
    return map;
  }, [members]);

  const capabilityByUser = useMemo(() => {
    const map = {};
    for (const m of members) {
      const id = memberUserId(m);
      if (!id) continue;
      if (Object.prototype.hasOwnProperty.call(capabilityOverrides, id)) {
        map[id] = capabilityOverrides[id];
      } else {
        map[id] = String(m.capabilityStatus || 'draft').trim() || 'draft';
      }
    }
    return map;
  }, [members, capabilityOverrides]);

  const activeFilterCount = [roleFilter, statusFilter, capabilityFilter, scopeFilter].filter(Boolean).length;

  useEffect(() => {
    setPage(1);
  }, [orgId, debouncedQuery, roleFilter, statusFilter, capabilityFilter, scopeFilter, sortKey, sortDir, pageSize]);

  useEffect(() => {
    setCapabilityOverrides({});
  }, [orgId]);

  useEffect(() => {
    if (!orgId || grantsLoading) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const {
          structureRes,
          assignRes,
          positionRes,
          positionAssignRes,
          assignmentsFailed,
        } = await fetchUsersListEnrichment(orgId, {
          includeOrgRoleAssignments: canViewOrgRoleAssignments,
        });
        // apiClient interceptor trả body ({ success, data }) — không còn axios.response.
        const body = structureRes?.data ?? structureRes;
        const assignments =
          assignRes?.data?.assignments ||
          assignRes?.assignments ||
          [];
        const positions =
          positionRes?.data?.positions ||
          positionRes?.positions ||
          [];
        const positionAssignments =
          positionAssignRes?.data?.assignments ||
          positionAssignRes?.assignments ||
          [];
        const positionNameById = new Map(
          (Array.isArray(positions) ? positions : []).map((row) => [
            String(row?.id || row?._id || '').trim(),
            String(row?.title || row?.name || '').trim(),
          ])
        );
        const nextPositionByUser = {};
        const roleFromPosition = {};
        for (const row of Array.isArray(positionAssignments) ? positionAssignments : []) {
          const uid = String(row?.userId || '').trim();
          const name =
            String(row?.positionName || '').trim() ||
            positionNameById.get(String(row?.positionId || '').trim());
          if (uid && name && !nextPositionByUser[uid]) nextPositionByUser[uid] = name;
          const labels = Array.isArray(row?.orgRoleLabels) ? row.orgRoleLabels.filter(Boolean) : [];
          const keys = Array.isArray(row?.orgRoleKeys) ? row.orgRoleKeys.filter(Boolean) : [];
          if (!uid || (!labels.length && !keys.length)) continue;
          const rows = (keys.length ? keys : labels).map((keyOrLabel, i) => ({
            roleKey: keys[i] || undefined,
            label: labels[i] || labels[0] || keyOrLabel,
          }));
          const prev = roleFromPosition[uid] || [];
          for (const r of rows) {
            if (!prev.some((p) => (p.roleKey && r.roleKey ? p.roleKey === r.roleKey : p.label === r.label))) {
              prev.push(r);
            }
          }
          roleFromPosition[uid] = prev;
        }
        if (!cancelled) {
          setStructureMaps(collectDeptTeamMaps(body));
          // Gộp gán catalog + vai từ vị trí (không ghi đè lẫn nhau).
          const rowMap = buildOrgRoleRowsByUserId({ branches: [] }, assignments, tRef.current);
          const mergedRoles = Object.fromEntries(rowMap);
          for (const [uid, rows] of Object.entries(roleFromPosition)) {
            const prev = mergedRoles[uid] || [];
            for (const r of rows) {
              if (
                !prev.some((p) =>
                  p.roleKey && r.roleKey ? p.roleKey === r.roleKey : p.label === r.label
                )
              ) {
                prev.push(r);
              }
            }
            mergedRoles[uid] = prev;
          }
          setOrgRoleByUser(mergedRoles);
          setPositionByUser(nextPositionByUser);
          setStructureLoadFailed(assignmentsFailed);
        }
      } catch {
        if (!cancelled) {
          setStructureMaps({ departments: new Map(), teams: new Map() });
          setOrgRoleByUser({});
          setPositionByUser({});
          setStructureLoadFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, structureReloadKey, grantsLoading, canViewOrgRoleAssignments]);

  const formatWhen = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const scopeOptions = useMemo(() => {
    const opts = [];
    for (const [id, name] of structureMaps.departments) {
      opts.push({ id: `dep:${id}`, label: name, type: 'department' });
    }
    for (const [id, name] of structureMaps.teams) {
      opts.push({ id: `team:${id}`, label: name, type: 'team' });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [structureMaps]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter && memberOrgRole(m) !== roleFilter) return false;
      if (statusFilter && memberStatusKey(m) !== statusFilter) return false;
      if (capabilityFilter) {
        const id = memberUserId(m);
        const cap = capabilityByUser[id] || 'draft';
        if (capabilityFilter === 'draft') {
          if (cap !== 'draft' && cap !== '') return false;
        } else if (cap !== capabilityFilter) {
          return false;
        }
      }
      if (scopeFilter) {
        const [kind, id] = scopeFilter.split(':');
        if (kind === 'dep' && memberDepartmentId(m) !== id) return false;
        if (kind === 'team' && memberTeamId(m) !== id) return false;
      }
      if (!q) return true;
      const id = memberUserId(m);
      const dep = structureMaps.departments.get(memberDepartmentId(m)) || '';
      const team = structureMaps.teams.get(memberTeamId(m)) || '';
      const rbacLabels = formatRbacRoleLabels(rbacByUser[id] || [], (row) =>
        normalizeRoleDisplayName(row?.name || row?.role?.name)
      );
      const positionLabel = String(positionByUser[id] || '').toLowerCase();
      const orgRoleLabels = (orgRoleByUser[id] || []).map((row) => String(row?.label || '').toLowerCase());
      const code = memberEmployeeCode(m).toLowerCase();
      const roleLabel = accountRoleLabel(memberOrgRole(m), t).toLowerCase();
      return (
        memberDisplayName(m).toLowerCase().includes(q) ||
        memberEmail(m).toLowerCase().includes(q) ||
        memberOrgRole(m).includes(q) ||
        roleLabel.includes(q) ||
        positionLabel.includes(q) ||
        orgRoleLabels.some((label) => label.includes(q)) ||
        rbacLabels.some((label) => label.toLowerCase().includes(q)) ||
        dep.toLowerCase().includes(q) ||
        team.toLowerCase().includes(q) ||
        code.includes(q) ||
        id.toLowerCase().includes(q)
      );
    });
  }, [
    members,
    debouncedQuery,
    roleFilter,
    statusFilter,
    capabilityFilter,
    scopeFilter,
    structureMaps,
    rbacByUser,
    capabilityByUser,
    positionByUser,
    orgRoleByUser,
    t,
  ]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => compareMembersForAdminList(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const handleSortColumn = (columnKey) => {
    if (sortKey === columnKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(columnKey);
    setSortDir('asc');
  };

  const clearListFilters = () => {
    setRoleFilter('');
    setStatusFilter('');
    setCapabilityFilter('');
    setScopeFilter('');
  };

  const clearAllFilters = () => {
    clearListFilters();
    setQuery('');
  };

  const showMembersError = Boolean(membersError) && !members.length && !loading;
  const showMembersSkeleton = loading && !members.length;
  const showTableBody = !showMembersError && !showMembersSkeleton;
  const isFilteredEmpty =
    showTableBody && !sorted.length && members.length > 0 && (Boolean(query.trim()) || activeFilterCount > 0);

  /** Xác nhận xóa duy nhất nằm ở tab delete (ConfirmDialog danger) — ở đây chỉ điều hướng. */
  const requestDelete = (member) => {
    const id = memberUserId(member);
    if (!id) return;
    if (isSystemAdminMember(member)) {
      toast.error(t('adminUsers.removeSystemAdminBlocked'));
      return;
    }
    navigate(adminUserHubLink('/admin/users/people-ops', id, 'delete'));
  };

  return (
    <div className="mx-auto flex max-h-[calc(100dvh-7.5rem)] min-h-0 max-w-[1400px] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t('adminDomains.users.list')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {organization?.name ? `${organization.name} · ` : ''}
            {t('adminUsers.listCount', { n: sorted.length, total: members.length })}
            {' · '}
            {t('adminUsers.listPageSizeHint', { size: pageSize })}
          </p>
        </div>
        {canInvite ? (
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/users/import" className={adminPrimaryBtnClass('px-3.5')}>
              <UserPlus className="h-4 w-4" />
              {t('adminDomains.users.import')}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <AdminListSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('adminUsers.searchPlaceholder')}
            />
          </div>
          <AdminListFilterPopover
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            activeCount={activeFilterCount}
            label={t('adminUsers.filters')}
            activeTitle={t('adminUsers.filtersActive', { n: activeFilterCount })}
            clearLabel={t('adminUsers.filtersClear')}
            onClear={clearListFilters}
            menuKey="users-list-filters"
          >
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
              aria-label={t('adminUsers.filterRoleAria')}
            >
              <option value="">{t('adminUsers.filterAllRoles')}</option>
              <option value="admin">{t('adminUsers.roleAdmin')}</option>
              <option value="member">{t('adminUsers.roleMember')}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
              aria-label={t('adminUsers.filterStatusAria')}
            >
              <option value="">{t('adminUsers.filterAllStatus')}</option>
              <option value="active">{t('adminUsers.statusActive')}</option>
              <option value="locked">{t('adminUsers.statusLocked')}</option>
              <option value="inactive">{t('adminUsers.statusInactive')}</option>
              <option value="mustChangePassword">{t('adminUsers.statusMustChangePassword')}</option>
            </select>
            <select
              value={capabilityFilter}
              onChange={(e) => setCapabilityFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
              aria-label={t('adminUsers.filterCapability')}
            >
              <option value="">{t('adminUsers.filterAllCapability')}</option>
              <option value="pending_hr">{t('adminUsers.filterCapPending')}</option>
              <option value="verified">{t('adminUsers.filterCapVerified')}</option>
              <option value="rejected">{t('adminUsers.filterCapRejected')}</option>
              <option value="draft">{t('adminUsers.filterCapDraft')}</option>
            </select>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
              aria-label={t('adminUsers.filterScopeAria')}
            >
              <option value="">{t('adminUsers.filterAllScopes')}</option>
              {scopeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.type === 'team' ? `${t('adminUsers.colTeam')} · ${opt.label}` : opt.label}
                </option>
              ))}
            </select>
            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = String(e.target.value || 'name:asc').split(':');
                setSortKey(k === 'employeeCode' || k === 'email' ? k : 'name');
                setSortDir(d === 'desc' ? 'desc' : 'asc');
              }}
              className={FILTER_SELECT_CLASS}
              aria-label={t('adminUsers.sortBy')}
            >
              <option value="name:asc">{t('adminUsers.sortNameAz')}</option>
              <option value="name:desc">{t('adminUsers.sortNameZa')}</option>
              <option value="employeeCode:asc">{t('adminUsers.sortCodeAz')}</option>
              <option value="employeeCode:desc">{t('adminUsers.sortCodeZa')}</option>
            </select>
          </AdminListFilterPopover>
        </div>
      </div>

      {structureLoadFailed ? (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-warning bg-warning-bg px-4 py-2.5 text-sm text-warning"
        >
          <span>{t('adminUsers.structureLoadFail')}</span>
          <button
            type="button"
            onClick={() => setStructureReloadKey((k) => k + 1)}
            className={adminSecondaryBtnClass('px-3 py-1.5 text-xs')}
          >
            {t('adminUsers.listRetry')}
          </button>
        </div>
      ) : null}

      <AdminDenseTableCard className="min-h-0 flex-1">
        {showMembersError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t('companyAdmin.loadMembersFail')}</p>
            <button
              type="button"
              onClick={() => loadMembers()}
              className={adminPrimaryBtnClass('px-3.5 py-2')}
            >
              {t('adminUsers.listRetry')}
            </button>
          </div>
        ) : (
          <>
            <AdminDenseTableScroll>
              {showMembersSkeleton ? (
                <div className="space-y-2 p-3 md:hidden" aria-hidden>
                  {Array.from({ length: 4 }, (_, idx) => (
                    <div key={idx} className="h-16 rounded-lg bg-muted motion-safe:animate-pulse" />
                  ))}
                </div>
              ) : null}
              {showTableBody ? (
                <AdminDenseMobileList
                  items={pageItems}
                  getKey={memberUserId}
                  ariaLabel={t('adminDomains.users.list')}
                  onSelect={setDetailMember}
                  selectedKey={detailMember ? memberUserId(detailMember) : null}
                  renderTitle={(m) => memberDisplayName(m)}
                  renderMeta={(m) => {
                    const id = memberUserId(m);
                    const roleLabel = (orgRoleByUser[id] || []).map((row) => row.label).filter(Boolean).join(', ');
                    const positionLabel = positionByUser[id] || '';
                    return (
                      <span className="block min-w-0">
                        <span className="block truncate">{memberEmail(m)}</span>
                        <span className="mt-0.5 block truncate">
                          {roleLabel || t('adminUsers.orgRoleNone')}
                          {' · '}
                          {positionLabel || t('adminUsers.positionNone')}
                        </span>
                      </span>
                    );
                  }}
                  renderBadge={(m) => <StatusBadge member={m} t={t} />}
                  renderActions={(m) => (
                    <AdminUserActionsMenu
                      member={m}
                      onViewDetail={setDetailMember}
                      onRequestDelete={canDeleteEmployee ? requestDelete : undefined}
                      disableDelete={!canDeleteEmployee || isSystemAdminMember(m)}
                    />
                  )}
                />
              ) : null}
              <table className="hidden min-w-full text-sm md:table">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <SortableTh
                      label={t('adminUsers.colUser')}
                      columnKey="name"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSortColumn}
                    />
                    <SortableTh
                      label={t('adminUsers.colEmployeeCode')}
                      columnKey="employeeCode"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSortColumn}
                    />
                    <SortableTh
                      label={t('companyAdmin.colEmail')}
                      columnKey="email"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSortColumn}
                    />
                    <th className="px-4 py-3" title={t('adminUsers.colOrgRoleHint')}>
                      {t('adminUsers.colOrgRole')}
                    </th>
                    <th className="px-4 py-3" title={t('adminUsers.colPositionHint')}>
                      {t('adminUsers.colPosition')}
                    </th>
                    <th className="px-4 py-3">{t('adminUsers.colStatus')}</th>
                    <th className="px-4 py-3">{t('adminUsers.colCapability')}</th>
                    <th className="w-12 px-2 py-3 text-center">
                      <span className="sr-only">{t('adminUsers.colActions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {showMembersSkeleton ? <UsersTableSkeletonRows /> : null}
                  {showTableBody
                    ? pageItems.map((m) => {
                    const id = memberUserId(m);
                    const name = memberDisplayName(m);
                    const code = memberEmployeeCode(m);
                    const isSystemAdmin = isSystemAdminMember(m);
                    return (
                      <tr
                        key={id}
                        className={adminDenseRowClass()}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="flex max-w-[240px] items-center gap-3 rounded-lg text-left transition-transform duration-200 ease-out hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-x-0"
                            onClick={() => setDetailMember(m)}
                          >
                            <UserAvatar
                              avatar={m.avatar}
                              userId={id}
                              name={name}
                              size="sm"
                              className="shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="truncate font-medium text-foreground hover:underline">{name}</span>
                              {isSystemAdmin ? (
                                <span className="mt-0.5 block text-[10px] font-semibold text-ai">
                                  {t('adminNav.systemRoleBadge')}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                          {code || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{memberEmail(m)}</td>
                        <td className="px-4 py-3">
                          <OrgRoleCell
                            rows={orgRoleByUser[id]}
                            emptyLabel={t('adminUsers.orgRoleNone')}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <PositionCell
                            title={positionByUser[id]}
                            emptyLabel={t('adminUsers.positionNone')}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge member={m} t={t} />
                        </td>
                        <td className="px-4 py-3">
                          <CapabilityStatusBadge status={capabilityByUser[id] || 'draft'} t={t} />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <AdminUserActionsMenu
                            member={m}
                            onViewDetail={setDetailMember}
                            onRequestDelete={canDeleteEmployee ? requestDelete : undefined}
                            disableDelete={!canDeleteEmployee || isSystemAdminMember(m)}
                          />
                        </td>
                      </tr>
                    );
                  })
                  : null}
                </tbody>
              </table>
              {isFilteredEmpty ? (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">{t('adminUsers.noUsersFiltered')}</p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className={adminSecondaryBtnClass('px-3.5 py-2')}
                  >
                    {t('adminUsers.filtersClear')}
                  </button>
                </div>
              ) : null}
              {showTableBody && !sorted.length && !isFilteredEmpty ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t('adminUsers.noUsers')}
                </p>
              ) : null}
            </AdminDenseTableScroll>
            {showTableBody && sorted.length > 0 ? (
              <AdminListPagination
                page={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                labels={{
                  prev: t('adminUsers.listPrev'),
                  next: t('adminUsers.listNext'),
                  pageLabel: t('adminUsers.listPage', { page: safePage, total: totalPages }),
                  pageSizeAria: t('adminUsers.listPageSizeHint', { size: pageSize }),
                }}
              />
            ) : null}
          </>
        )}
      </AdminDenseTableCard>

      <AdminUserDetailDrawer
        orgId={orgId}
        member={detailMember}
        open={Boolean(detailMember)}
        onClose={() => setDetailMember(null)}
        departmentName={
          detailMember
            ? structureMaps.departments.get(memberDepartmentId(detailMember)) || ''
            : ''
        }
        teamName={
          detailMember ? structureMaps.teams.get(memberTeamId(detailMember)) || '' : ''
        }
        rbacRoles={
          detailMember ? rbacByUser[memberUserId(detailMember)] || [] : []
        }
        formatWhen={formatWhen}
        onCapabilityStatusChange={(userId, status) => {
          setCapabilityOverrides((prev) => ({ ...prev, [userId]: status }));
        }}
        organizationalPosition={
          detailMember ? positionByUser[memberUserId(detailMember)] || '' : ''
        }
        orgRoleRows={
          detailMember ? orgRoleByUser[memberUserId(detailMember)] || [] : []
        }
      />
    </div>
  );
}
