import { useMemo } from 'react';
import { useAppStrings } from '../../locales/appStrings';
import AdminOrgUnitOpsHubShell from '../../components/Admin/AdminOrgUnitOpsHubShell';
import useAdminOrgStructure from '../../hooks/useAdminOrgStructure';
import { useAdminActionGate } from '../../hooks/useAdminActionGate';
import { RBAC_GRANT } from '../../config/rbacUiGrantMap';
import DivisionEditPanel from './DivisionEditPanel';
import DivisionDisablePanel from './DivisionDisablePanel';
import DivisionDeptPanel from './DivisionDeptPanel';

const TAB_EDIT = 'edit';
const TAB_DISABLE = 'disable';
const TAB_DEPT = 'departments';

export default function DivisionManageHubPanel({ orgId }) {
  const { t } = useAppStrings();
  const { can, grantsLoading } = useAdminActionGate(orgId);
  const canUpdateDivision = can(RBAC_GRANT.DIVISION_UPDATE);
  const { divisions, loading, error, loadStructure } = useAdminOrgStructure(orgId, {
    includeInactive: true,
  });

  const tabs = useMemo(() => {
    if (!canUpdateDivision) return [];
    return [
      { id: TAB_EDIT, label: t('adminDomains.orgStructure.divisionEdit') },
      { id: TAB_DISABLE, label: t('adminDomains.orgStructure.divisionDisable') },
      { id: TAB_DEPT, label: t('adminDomains.orgStructure.divisionDept') },
    ];
  }, [t, canUpdateDivision]);

  if (!grantsLoading && !canUpdateDivision) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {t('adminOrg.grantDenied')}
      </p>
    );
  }

  return (
    <AdminOrgUnitOpsHubShell
      title={t('adminDomains.orgStructure.divisionManageHub')}
      hint={t('adminOrg.divisionManageHubHint')}
      tabs={tabs}
      defaultTab={TAB_EDIT}
      items={divisions}
      loading={loading || grantsLoading}
      error={error}
      onRetry={() => loadStructure()}
      pickerHint={t('adminOrg.divisionEditPickerHint')}
      subtitleFn={(row) => row.branchName || ''}
      badgeFn={(row) => (row.isActive === false ? t('adminOrg.inactive') : t('adminOrg.active'))}
    >
      {({ activeTab }) => (
        <div className="space-y-4">
          {activeTab === TAB_EDIT ? <DivisionEditPanel orgId={orgId} embedded /> : null}
          {activeTab === TAB_DISABLE ? <DivisionDisablePanel orgId={orgId} embedded /> : null}
          {activeTab === TAB_DEPT ? <DivisionDeptPanel orgId={orgId} embedded /> : null}
        </div>
      )}
    </AdminOrgUnitOpsHubShell>
  );
}
