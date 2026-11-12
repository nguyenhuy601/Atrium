import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AdminUserActionsMenu from '../../components/adminUsers/AdminUserActionsMenu';
import {
  ADMIN_LIST_PAGE_SIZE,
  AdminDenseMobileList,
  AdminDenseTableCard,
  AdminDenseTableScroll,
  AdminListFilterPopover,
  AdminListPagination,
  AdminListSearchInput,
  AdminPillBadge,
  AdminUserPanelShell,
  adminDenseRowClass,
  adminFilterSelectClass,
  adminPrimaryBtnClass,
} from '../../components/adminUsers/adminUserPanelUi';
import useAdminMembers from '../../hooks/useAdminMembers';
import { useDebouncedValue } from '../search/useDebouncedValue';
import { useAppStrings } from '../../locales/appStrings';
import UserAvatar from '../../components/Shared/UserAvatar';
import {
  memberDisplayName,
  memberEmail,
  memberUserId,
} from '../../utils/adminUserUtils';

const FILTER_SELECT_CLASS = adminFilterSelectClass();

function isAccountInactive(member) {
  return member?.isActive === false || Boolean(member?.isLocked);
}

function systemRoleLabel(member, t) {
  const role = String(member?.systemRole || 'employee').trim().toLowerCase();
  if (role === 'admin') return t('adminAccounts.systemAdmin');
  return t('adminAccounts.employee');
}

function AccountsTableSkeletonRows({ rows = ADMIN_LIST_PAGE_SIZE }) {
  return Array.from({ length: rows }, (_, rowIdx) => (
    <tr key={`sk-${rowIdx}`}>
      {Array.from({ length: 7 }, (_, colIdx) => (
        <td key={colIdx} className="px-3 py-2.5">
          <span className="inline-block h-4 w-full max-w-[7rem] rounded bg-muted motion-safe:animate-pulse" />
        </td>
      ))}
    </tr>
  ));
}

export default function AccountsListPanel({ orgId }) {
  const { t, locale } = useAppStrings();
  const { members, loading, error: membersError, loadMembers } = useAdminMembers(orgId, {
    view: 'admin_table',
  });
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ADMIN_LIST_PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [orgId, debouncedQuery, statusFilter, pageSize]);

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

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter === 'active' && isAccountInactive(m)) return false;
      if (statusFilter === 'inactive' && !isAccountInactive(m)) return false;
      if (!q) return true;
      const name = memberDisplayName(m).toLowerCase();
      const email = memberEmail(m).toLowerCase();
      const roleLabel = systemRoleLabel(m, t).toLowerCase();
      return name.includes(q) || email.includes(q) || roleLabel.includes(q);
    });
  }, [members, debouncedQuery, statusFilter, t]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const showMembersError = Boolean(membersError) && !members.length && !loading;
  const showMembersSkeleton = loading && !members.length;
  const activeFilterCount = statusFilter ? 1 : 0;
  const hasRows = !showMembersError && !showMembersSkeleton && pageItems.length > 0;

  return (
    <AdminUserPanelShell
      wide
      title={t('adminDomains.accounts.list')}
      hint={`${t('adminAccounts.listHint')} · ${t('adminAccounts.listCount', {
        n: filtered.length,
        total: members.length,
      })} · ${t('adminUsers.listPageSizeHint', { size: pageSize })}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <AdminListSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('adminAccounts.searchPlaceholder')}
          />
        </div>
        <AdminListFilterPopover
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          activeCount={activeFilterCount}
          label={t('adminUsers.filters')}
          activeTitle={t('adminUsers.filtersActive', { n: activeFilterCount })}
          clearLabel={t('adminUsers.filtersClear')}
          onClear={() => setStatusFilter('')}
          menuKey="accounts-list-filters"
        >
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={FILTER_SELECT_CLASS}
            aria-label={t('adminUsers.filterAllStatus')}
          >
            <option value="">{t('adminUsers.filterAllStatus')}</option>
            <option value="active">{t('adminUsers.statusActive')}</option>
            <option value="inactive">{t('adminUsers.statusInactive')}</option>
          </select>
        </AdminListFilterPopover>
      </div>

      <AdminDenseTableCard>
        <AdminDenseTableScroll>
          {hasRows ? (
            <AdminDenseMobileList
              items={pageItems}
              getKey={memberUserId}
              ariaLabel={t('adminDomains.accounts.list')}
              renderTitle={(member) => memberDisplayName(member)}
              renderMeta={(member) => (
                <span className="block min-w-0">
                  <span className="block truncate">{memberEmail(member) || '—'}</span>
                  <span className="mt-0.5 block truncate">{systemRoleLabel(member, t)}</span>
                </span>
              )}
              renderBadge={(member) => (
                <AdminPillBadge variant={isAccountInactive(member) ? 'muted' : 'success'}>
                  {isAccountInactive(member) ? t('adminUsers.statusInactive') : t('adminUsers.statusActive')}
                </AdminPillBadge>
              )}
              renderActions={(member) => <AdminUserActionsMenu member={member} variant="account" />}
            />
          ) : null}
          <table className={`min-w-full text-sm ${hasRows ? 'hidden md:table' : ''}`}>
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2.5">{t('adminUsers.colUser')}</th>
                <th className="px-3 py-2.5">{t('adminAccounts.colEmailVerified')}</th>
                <th className="px-3 py-2.5">{t('adminAccounts.colLocked')}</th>
                <th className="px-3 py-2.5">{t('adminAccounts.colMustChange')}</th>
                <th className="px-3 py-2.5">{t('adminUsers.colLastLogin')}</th>
                <th className="px-3 py-2.5">{t('adminAccounts.colSystemRole')}</th>
                <th className="w-12 px-2 py-2.5 text-center">
                  <span className="sr-only">{t('adminUsers.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {showMembersError ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center" role="alert">
                    <p className="text-sm text-destructive">{t('companyAdmin.loadMembersFail')}</p>
                    <button
                      type="button"
                      onClick={() => loadMembers()}
                      className={adminPrimaryBtnClass('mt-3 px-3.5 py-2')}
                    >
                      {t('adminUsers.listRetry')}
                    </button>
                  </td>
                </tr>
              ) : showMembersSkeleton ? (
                <AccountsTableSkeletonRows rows={pageSize} />
              ) : pageItems.length ? (
                pageItems.map((member) => {
                  const userId = memberUserId(member);
                  const inactive = isAccountInactive(member);
                  const isVerified = member.isEmailVerified !== false;
                  return (
                    <tr key={userId} className={adminDenseRowClass('hover:bg-muted')}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            avatar={member.avatar}
                            userId={userId}
                            name={memberDisplayName(member)}
                            size="chip"
                            className="shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{memberDisplayName(member)}</p>
                            <p className="truncate text-xs text-muted-foreground">{memberEmail(member) || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <AdminPillBadge variant={isVerified ? 'success' : 'warning'}>
                          {isVerified ? t('adminAccounts.verifiedYes') : t('adminAccounts.verifiedNo')}
                        </AdminPillBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <AdminPillBadge variant={inactive ? 'muted' : 'success'}>
                          {inactive ? t('adminUsers.statusInactive') : t('adminUsers.statusActive')}
                        </AdminPillBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        {member.mustChangePassword ? (
                          <AdminPillBadge variant="info">{t('adminUsers.statusMustChangePassword')}</AdminPillBadge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        {formatWhen(member.lastLoginAt)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{systemRoleLabel(member, t)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <AdminUserActionsMenu member={member} variant="account" />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {t('adminUsers.noUsers')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminDenseTableScroll>
        {!showMembersError && !showMembersSkeleton && filtered.length > 0 ? (
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
      </AdminDenseTableCard>

      <p className="mt-3 text-xs text-muted-foreground">
        {t('adminAccounts.listFootnote')}{' '}
        <Link
          to="/admin/users"
          className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('adminDomains.users.title')}
        </Link>
      </p>
    </AdminUserPanelShell>
  );
}
