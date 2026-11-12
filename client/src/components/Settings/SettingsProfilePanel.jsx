import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { GradientButton } from '../Shared';
import UserAvatar from '../Shared/UserAvatar';
import userService from '../../services/userService';
import authService from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useAppStrings } from '../../locales/appStrings';
import { resolveApiErrorMessage } from '../../utils/resolveApiErrorMessage';
import { mergeAuthUserFromProfile, unwrapApiData } from '../../utils/helpers';
import { pickAvatarValue } from '../../utils/avatarDisplay';
import { invalidateProtectedAvatarCache } from '../../utils/protectedMediaFetch';
import { getJwtEmail } from '../../utils/tokenStorage';
import { coalesceJobTitle } from '../../utils/jobTitleProfile';
import {
  birthYearOptions,
  isBirthDateComplete,
  validateBirthDateParts,
} from '../../utils/birthDateUtils';
import { formatOrgRoleRowsLabel, memberIsSystemAdmin } from '../../utils/effectiveOrgRoleLabel';
import { localizedPositionLabel } from '../../utils/positionLocale';
import useUserMe from '../../hooks/useUserMe';
import { useOrganizationsMy } from '../../hooks/queries/useOrganizationsMy';
import { useOrgMyProfile } from '../../hooks/queries/useOrgMyProfile';
import { queryKeys } from '../../lib/queryKeys';
import { FIGMA_SETTINGS_CARD, FIGMA_SETTINGS_INPUT } from './figmaSettingsClasses';

const isValidMongoObjectId = (s) =>
  typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s);

const READONLY_INPUT = `${FIGMA_SETTINGS_INPUT} cursor-default bg-muted text-muted-foreground`;

function applyBirthPartsFromProfile(dob, setters) {
  const { setBirthDay, setBirthMonth, setBirthYear } = setters;
  if (!dob) {
    setBirthDay('');
    setBirthMonth('');
    setBirthYear('');
    return;
  }
  const isoMatch = String(dob).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    setBirthYear(isoMatch[1]);
    setBirthMonth(String(Number(isoMatch[2])));
    setBirthDay(String(Number(isoMatch[3])));
    return;
  }
  const dt = new Date(dob);
  if (Number.isNaN(dt.getTime())) {
    setBirthDay('');
    setBirthMonth('');
    setBirthYear('');
    return;
  }
  setBirthYear(String(dt.getFullYear()));
  setBirthMonth(String(dt.getMonth() + 1));
  setBirthDay(String(dt.getDate()));
}

function formatJoinedAt(value, locale) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN');
}

function membershipStatusLabel(status, t) {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'active') return t('settingsPage.membershipStatusActive');
  if (key === 'pending') return t('settingsPage.membershipStatusPending');
  if (key === 'suspended') return t('settingsPage.membershipStatusSuspended');
  return '';
}

/**
 * Cài đặt → Hồ sơ (Phase 1): cá nhân editable + HR/org read-only.
 * Không gồm bio / location / orgNicknames / field chưa có schema.
 */
export default function SettingsProfilePanel() {
  const { t, locale } = useAppStrings();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { me: meProfile } = useUserMe({
    enabled: Boolean(user?.id || user?.userId || user?._id),
  });
  const orgsQuery = useOrganizationsMy({ enabled: Boolean(user) });

  const orgId = useMemo(() => {
    const orgs = Array.isArray(orgsQuery.data) ? orgsQuery.data : [];
    const first = orgs[0];
    const oid = first?._id ?? first?.id;
    const idStr = oid != null ? String(oid) : '';
    return isValidMongoObjectId(idStr) ? idStr : '';
  }, [orgsQuery.data]);

  const orgProfileQuery = useOrgMyProfile(orgId, {
    enabled: Boolean(orgId),
    include: 'organization',
  });

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    jobTitle: '',
  });
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthError, setBirthError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarCacheBust, setAvatarCacheBust] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const yearOptions = useMemo(() => birthYearOptions(), []);

  const readOnlyHr = useMemo(() => {
    const employeeCode = String(meProfile?.employeeCode || user?.employeeCode || '').trim();
    const username = String(meProfile?.username || user?.username || '').trim();
    return {
      employeeCode: employeeCode || t('settingsPage.valueEmpty'),
      username: username || t('settingsPage.valueEmpty'),
    };
  }, [meProfile, user, t]);

  const orgContext = useMemo(() => {
    const profile = orgProfileQuery.data || null;
    const placement = profile?.placement || {};
    const orgRoles =
      profile?.myOrganizationRoles ||
      profile?.organization?.myOrganizationRoles ||
      [];
    let roleLabel = '';
    if (memberIsSystemAdmin(user)) {
      roleLabel = t('adminUsers.roleVendor');
    } else {
      roleLabel = formatOrgRoleRowsLabel(orgRoles, t);
      if (!roleLabel && profile?.myRole) {
        const roleKey = String(profile.myRole).trim().toLowerCase();
        const membershipRoleKeys = {
          owner: 'settingsPage.membershipRoleOwner',
          admin: 'settingsPage.membershipRoleAdmin',
          hr: 'settingsPage.membershipRoleHr',
          member: 'settingsPage.membershipRoleMember',
        };
        roleLabel = membershipRoleKeys[roleKey]
          ? t(membershipRoleKeys[roleKey])
          : String(profile.myRole);
      }
    }
    const positionRaw = String(
      profile?.myPosition?.name || profile?.myPosition?.code || ''
    ).trim();
    const positionLabel = positionRaw
      ? localizedPositionLabel(positionRaw, positionRaw, t)
      : '';
    const department = String(placement.departmentName || '').trim();
    const team = String(placement.teamName || '').trim();
    const unitParts = [department, team].filter(Boolean);
    return {
      roleLabel: roleLabel || t('settingsPage.valueEmpty'),
      positionLabel: positionLabel || t('settingsPage.valueEmpty'),
      orgUnit: unitParts.length ? unitParts.join(' · ') : t('settingsPage.valueEmpty'),
      joinedAt:
        formatJoinedAt(profile?.joinedAt, locale) || t('settingsPage.valueEmpty'),
      membershipStatus:
        membershipStatusLabel(profile?.membershipStatus, t) ||
        t('settingsPage.valueEmpty'),
      hasOrg: Boolean(orgId),
    };
  }, [orgProfileQuery.data, orgId, user, t, locale]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      fullName:
        user?.displayName ||
        user?.fullName ||
        user?.name ||
        prev.fullName ||
        t('settingsPage.userFallback'),
      phone: user?.phone || user?.phoneNumber || user?.mobile || prev.phone || '',
      email: user?.email || prev.email || getJwtEmail() || '',
      jobTitle: coalesceJobTitle(user) || prev.jobTitle || '',
    }));
    const fromUser = pickAvatarValue(user?.avatar || user?.avatarUrl);
    if (fromUser) setAvatarUrl(fromUser);
  }, [user, t]);

  useEffect(() => {
    if (!meProfile || typeof meProfile !== 'object') return;
    const phoneValue = String(
      meProfile.phone || meProfile.phoneNumber || meProfile.mobile || ''
    ).trim();
    setForm((prev) => ({
      ...prev,
      fullName: meProfile.displayName || meProfile.fullName || meProfile.name || prev.fullName,
      phone: phoneValue || prev.phone || '',
      email: meProfile.email || prev.email || user?.email || getJwtEmail() || '',
      jobTitle: coalesceJobTitle(meProfile) || prev.jobTitle || '',
    }));
    applyBirthPartsFromProfile(meProfile.dateOfBirth, {
      setBirthDay,
      setBirthMonth,
      setBirthYear,
    });
    setBirthError('');
    updateUser(
      mergeAuthUserFromProfile(user, {
        ...meProfile,
        ...(phoneValue ? { phone: phoneValue } : {}),
      })
    );
    const fromMe = pickAvatarValue(meProfile.avatar || meProfile.avatarUrl);
    if (fromMe) setAvatarUrl(fromMe);
    // Chỉ hydrate khi meProfile đổi — tránh vòng updateUser.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [meProfile]);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.error(t('profileModal.imageOnly'));
      return;
    }
    const profileUserId = user?.userId || user?.id || user?._id;
    try {
      setAvatarUploading(true);
      const res = await userService.uploadAvatar(file);
      const updated = unwrapApiData(res);
      const nextUrl = pickAvatarValue(updated?.avatar || updated?.avatarUrl);
      if (!nextUrl) {
        toast.error(t('profileModal.avatarUrlMissing'));
        return;
      }
      const bust = Date.now();
      invalidateProtectedAvatarCache({ userId: profileUserId, cacheBust: bust });
      setAvatarCacheBust(bust);
      setAvatarUrl(nextUrl);
      updateUser(
        mergeAuthUserFromProfile(user, { ...updated, avatar: nextUrl }, { avatarBust: bust })
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
      toast.success(t('settingsPage.toastAvatar'));
    } catch (error) {
      toast.error(
        resolveApiErrorMessage(error, { t, fallback: t('profileModal.avatarUploadFail') })
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (profileSaving) return;

    let dateOfBirth;
    if (isBirthDateComplete({ birthDay, birthMonth, birthYear })) {
      const dob = validateBirthDateParts({ birthDay, birthMonth, birthYear });
      if (!dob.ok) {
        const codeMap = {
          required: 'register.errBirthRequired',
          invalid: 'register.errBirthInvalid',
          future: 'register.errBirthFuture',
          tooYoung: 'register.errBirthTooYoung',
        };
        setBirthError(t(codeMap[dob.code] || 'register.errBirthInvalid'));
        return;
      }
      setBirthError('');
      dateOfBirth = dob.iso;
    } else if (birthDay || birthMonth || birthYear) {
      setBirthError(t('register.errBirthRequired'));
      return;
    } else {
      setBirthError('');
    }

    const nextEmail = String(form.email || '').trim().toLowerCase();
    const currentEmail = String(user?.email || '').trim().toLowerCase();
    const payload = {
      displayName: String(form.fullName || '').trim(),
      phone: String(form.phone || '').trim(),
      jobTitle: String(form.jobTitle || '').trim(),
    };
    if (dateOfBirth) payload.dateOfBirth = dateOfBirth;

    setProfileSaving(true);
    try {
      if (nextEmail && nextEmail !== currentEmail) {
        await authService.requestEmailChange(nextEmail);
      }
      const res = await userService.updateProfile(payload);
      const saved = unwrapApiData(res) || res?.data || res;
      updateUser(mergeAuthUserFromProfile(user, { ...payload, ...saved }));
      queryClient.setQueryData(queryKeys.user.me(), (prev) =>
        prev && typeof prev === 'object' ? { ...prev, ...payload, ...saved } : saved
      );
      setForm((prev) => ({
        ...prev,
        fullName: payload.displayName || prev.fullName,
        phone: saved?.phone || payload.phone || prev.phone,
        jobTitle: coalesceJobTitle({ ...prev, ...payload, ...saved }) || prev.jobTitle,
      }));
      if (nextEmail && nextEmail !== currentEmail) {
        toast.success(t('settingsPage.toastEmailChangeRequested'));
      } else {
        toast.success(t('settingsPage.toastSaveProfile'));
      }
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, { t, fallback: t('errors.generic') }));
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-bold text-foreground">
          {t('settingsPage.profileTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('settingsPage.pageSubtitleUser')}</p>
      </div>

      <div className={`${FIGMA_SETTINGS_CARD} space-y-4`}>
        <div className="flex items-center gap-5">
          <UserAvatar
            avatar={avatarUrl || user?.avatar || null}
            userId={user?.userId || user?.id || user?._id}
            name={form.fullName || user?.displayName || user?.name}
            size="2xl"
            cacheBust={avatarCacheBust || user?.avatarCacheKey || undefined}
          />
          <label
            className={`inline-flex ${avatarUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={avatarUploading}
              onChange={handleAvatarChange}
            />
            <span className="motion-safe:transition-colors motion-reduce:transition-none rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {avatarUploading
                ? t('profileModal.changeAvatarUploading')
                : t('settingsPage.changeAvatar')}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('settingsPage.employeeCode')}
            </label>
            <input type="text" readOnly value={readOnlyHr.employeeCode} className={READONLY_INPUT} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('settingsPage.username')}
            </label>
            <input type="text" readOnly value={readOnlyHr.username} className={READONLY_INPUT} />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('settingsPage.fullName')}
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            className={`${FIGMA_SETTINGS_INPUT} motion-safe:transition-colors motion-reduce:transition-none`}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('settingsPage.jobTitle')}
          </label>
          <input
            type="text"
            value={form.jobTitle}
            onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
            className={`${FIGMA_SETTINGS_INPUT} motion-safe:transition-colors motion-reduce:transition-none`}
            placeholder={t('settingsPage.jobTitlePh')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('settingsPage.email')}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={`${FIGMA_SETTINGS_INPUT} motion-safe:transition-colors motion-reduce:transition-none`}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('settingsPage.emailChangeHint')}</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('settingsPage.phone')}
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className={`${FIGMA_SETTINGS_INPUT} motion-safe:transition-colors motion-reduce:transition-none`}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('profileModal.birthDate')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t('register.birthDay')}</span>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className={FIGMA_SETTINGS_INPUT}
              >
                <option value="">{t('register.birthDayPlaceholder')}</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t('register.birthMonth')}</span>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className={FIGMA_SETTINGS_INPUT}
              >
                <option value="">{t('register.birthMonthPlaceholder')}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t('register.birthYear')}</span>
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className={FIGMA_SETTINGS_INPUT}
              >
                <option value="">{t('register.birthYearPlaceholder')}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {birthError ? (
            <p className="mt-1 text-xs text-destructive">{birthError}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('profileModal.birthDateEditableHint')}
            </p>
          )}
        </div>
      </div>

      {orgContext.hasOrg ? (
        <div className={`${FIGMA_SETTINGS_CARD} space-y-4`}>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {t('settingsPage.orgContextTitle')}
            </h3>
            <p className="text-xs text-muted-foreground">{t('settingsPage.orgContextHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t('settingsPage.orgRole')}
              </label>
              <input type="text" readOnly value={orgContext.roleLabel} className={READONLY_INPUT} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t('settingsPage.orgPosition')}
              </label>
              <input
                type="text"
                readOnly
                value={orgContext.positionLabel}
                className={READONLY_INPUT}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t('settingsPage.orgUnit')}
              </label>
              <input type="text" readOnly value={orgContext.orgUnit} className={READONLY_INPUT} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t('settingsPage.joinedAt')}
              </label>
              <input type="text" readOnly value={orgContext.joinedAt} className={READONLY_INPUT} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t('settingsPage.membershipStatus')}
              </label>
              <input
                type="text"
                readOnly
                value={orgContext.membershipStatus}
                className={READONLY_INPUT}
              />
            </div>
          </div>
        </div>
      ) : null}

      <GradientButton
        variant="primary"
        onClick={handleSave}
        aria-busy={profileSaving}
        disabled={profileSaving}
        className="motion-safe:transition-colors motion-reduce:transition-none"
      >
        {t('settingsPage.saveChanges')}
      </GradientButton>
    </div>
  );
}
