import { REPORT_DIMENSIONS } from './closureReportSelection';
import { REPORT_BTN_SECONDARY, REPORT_CARD, REPORT_SELECT } from './hubDashboardUi';

function SlicerSelect({ label, options, dimension, selection, onSelect, allLabel }) {
  if (!options?.length) return null;
  const active = selection?.dimension === dimension ? String(selection?.key || '') : '';
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select
        className={REPORT_SELECT}
        value={active}
        aria-label={label}
        onChange={(e) => onSelect(dimension, e.target.value || null)}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ClosureReportSlicers({ view, selection, onSelect, onClear, t }) {
  const slicers = view?.slicers || {};
  const allLabel = t('workspace.closureReportSlicerAll');
  return (
    <div className={`${REPORT_CARD} p-3 sm:p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SlicerSelect
            label={t('workspace.closureReportSlicerSprint')}
            options={slicers.sprints}
            dimension={REPORT_DIMENSIONS.SPRINT}
            selection={selection}
            onSelect={onSelect}
            allLabel={allLabel}
          />
          <SlicerSelect
            label={t('workspace.closureReportSlicerIssueType')}
            options={slicers.issueTypes}
            dimension={REPORT_DIMENSIONS.ISSUE_TYPE}
            selection={selection}
            onSelect={onSelect}
            allLabel={allLabel}
          />
          <SlicerSelect
            label={t('workspace.closureReportSlicerUser')}
            options={slicers.users}
            dimension={REPORT_DIMENSIONS.USER}
            selection={selection}
            onSelect={onSelect}
            allLabel={allLabel}
          />
          <SlicerSelect
            label={t('workspace.closureReportSlicerCr')}
            options={slicers.crStatuses}
            dimension={REPORT_DIMENSIONS.CR_STATUS}
            selection={selection}
            onSelect={onSelect}
            allLabel={allLabel}
          />
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!selection?.dimension}
          className={REPORT_BTN_SECONDARY}
        >
          {t('workspace.closureReportClearFilter')}
        </button>
      </div>
    </div>
  );
}
