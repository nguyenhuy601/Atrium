import { useMemo } from 'react';
import { Briefcase, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import { useOrgMyProfile } from '../../hooks/queries/useOrgMyProfile';
import { useAppStrings } from '../../locales/appStrings';
import { coalesceJobTitle } from '../../utils/jobTitleProfile';
import {
  formatOrgRoleRowsLabel,
  memberIsSystemAdmin,
} from '../../utils/effectiveOrgRoleLabel';
import { FIGMA_SIDEBAR_FOOTER } from './figmaShellClasses';
import { localizedPositionLabel } from '../../utils/positionLocale';

function humanizeKey(key) {
  return String(key || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSidebarPositionLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^[a-z0-9_]+$/i.test(text) && text.includes('_')) {
    return humanizeKey(text);
  }
  return text;
}

/** Shared org role / position labels for sidebar identity card. */
export function useSidebarOrgIdentity() {
  const { t } = useAppStrings();
  const { user } = useAuth();
  const { company, activeWorkspace, lastOrganizationId } = useWorkspace();
  const { isSystemAdmin } = useCompanyAdminAccess();

  const orgId = String(
    company?.id ||
      company?._id ||
      activeWorkspace?._id ||
      activeWorkspace?.id ||
      lastOrganizationId ||
      ''
  ).trim();
  const profileQuery = useOrgMyProfile(orgId, {
    enabled: Boolean(orgId) && !isSystemAdmin,
  });
  const profile = profileQuery.data || null;

  const orgRoleLabel = useMemo(() => {
    if (isSystemAdmin || memberIsSystemAdmin(user)) {
      return t('adminUsers.roleVendor');
    }
    const rows =
      profile?.myOrganizationRoles ||
      company?.myOrganizationRoles ||
      activeWorkspace?.myOrganizationRoles ||
      [];
    return formatOrgRoleRowsLabel(rows, t);
  }, [
    isSystemAdmin,
    user,
    profile?.myOrganizationRoles,
    company?.myOrganizationRoles,
    activeWorkspace?.myOrganizationRoles,
    t,
  ]);

  const orgPositionLabel = useMemo(() => {
    const pos = profile?.myPosition || company?.myPosition || null;
    const raw = String(pos?.name || pos?.code || '').trim();
    if (!raw) return '';
    return localizedPositionLabel(raw, formatSidebarPositionLabel(raw), t);
  }, [profile?.myPosition, company?.myPosition, t]);

  const hrJobTitleLabel = useMemo(() => {
    const raw = coalesceJobTitle(user);
    return localizedPositionLabel(raw, formatSidebarPositionLabel(raw), t);
  }, [user, t]);

  const primary = orgRoleLabel || '';
  const positionLabel = orgPositionLabel || '';
  const showPosition =
    Boolean(positionLabel) &&
    positionLabel.toLowerCase() !== String(primary || '').toLowerCase();
  const showHrJobTitle =
    Boolean(hrJobTitleLabel) &&
    hrJobTitleLabel.toLowerCase() !== String(positionLabel || '').toLowerCase() &&
    hrJobTitleLabel.toLowerCase() !== String(primary || '').toLowerCase();

  return {
    primary,
    positionLabel: showPosition ? positionLabel : '',
    displayPositionLabel: positionLabel,
    showPosition,
    showHrJobTitle,
    hrJobTitleLabel,
  };
}

/**
 * Footer SoT: Vai trò tổ chức + Vị trí tổ chức (assignment từ my-profile).
 * Chức danh HR hồ sơ chỉ hiện phụ nếu khác vị trí.
 */
export default function SidebarPositionFooter({ collapsed = false, wrap = true }) {
  const { t } = useAppStrings();
  const {
    primary,
    positionLabel,
    showPosition,
    showHrJobTitle,
    hrJobTitleLabel,
  } = useSidebarOrgIdentity();

  const body = collapsed ? (
    <div
      className="flex flex-col items-center gap-1 py-0.5"
      title={primary || positionLabel || t('nav.orgRoleUnassigned')}
    >
      <Shield size={14} className="text-white/35" aria-hidden />
      {primary || positionLabel ? (
        <span className="inline-flex max-w-full truncate rounded border border-sky-300/35 bg-sky-400/25 px-1 py-0.5 text-[0.55rem] font-bold tracking-wide !text-sky-50">
          {(primary || positionLabel).length > 8
            ? `${(primary || positionLabel).slice(0, 8)}…`
            : primary || positionLabel}
        </span>
      ) : null}
    </div>
  ) : (
    <div className="space-y-2 px-1.5 py-1">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-wider text-white/40">
          <Shield size={10} aria-hidden />
          {t('nav.yourOrgRole')}
        </div>
        {primary ? (
          <span
            title={primary}
            className="inline-block max-w-full whitespace-normal break-words rounded border border-sky-300/35 bg-sky-400/25 px-1.5 py-0.5 text-left text-[0.625rem] font-bold leading-snug tracking-wide !text-sky-50"
          >
            {primary}
          </span>
        ) : (
          <p className="text-[0.625rem] text-white/45">{t('nav.orgRoleUnassigned')}</p>
        )}
      </div>
      {showPosition ? (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-wider text-white/35">
            <Briefcase size={10} aria-hidden />
            {t('nav.yourPosition')}
          </div>
          <span
            title={positionLabel}
            className="inline-block max-w-full whitespace-normal break-words rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-left text-[0.625rem] font-semibold leading-snug tracking-wide text-white/85"
          >
            {positionLabel}
          </span>
        </div>
      ) : (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-wider text-white/35">
            <Briefcase size={10} aria-hidden />
            {t('nav.yourPosition')}
          </div>
          <p className="text-[0.625rem] text-white/45">{t('nav.positionUnassigned')}</p>
        </div>
      )}
      {showHrJobTitle ? (
        <p className="text-[0.55rem] leading-snug text-white/35" title={hrJobTitleLabel}>
          {t('nav.hrJobTitleHint')}: {hrJobTitleLabel}
        </p>
      ) : null}
    </div>
  );

  if (!wrap) return body;
  return <div className={FIGMA_SIDEBAR_FOOTER}>{body}</div>;
}
