/**
 * Gate2 / HOW Monitor — drill-down Test Case (steps, preconditions, data).
 * Read-only by default; when editable (decision=edit), patches editedPayload via onChange.
 */

import { X } from 'lucide-react';

function labelOf(t, key, fallback) {
  const value = typeof t === 'function' ? t(key) : '';
  if (value == null || value === '' || value === key) return fallback;
  return value;
}

function DetailList({ title, items, empty }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      {items?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function executionLabel(row, t) {
  const status = String(row?.executionStatus || '').toLowerCase();
  if (status === 'passed') {
    return labelOf(t, 'requirements.qualityReviewPassed', 'Đạt');
  }
  if (status === 'failed') {
    return labelOf(t, 'requirements.qualityReviewFailed', 'Không đạt');
  }
  return labelOf(t, 'requirements.qualityReviewNotRun', 'Chưa chạy');
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function asSteps(value) {
  if (!Array.isArray(value)) return [];
  return value.map((step, index) => ({
    stepNo: step?.stepNo || index + 1,
    action: String(step?.action || ''),
    expectedResult: String(step?.expectedResult || ''),
  }));
}

function asTestData(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    field: String(item?.field || ''),
    value: String(item?.value || ''),
  }));
}

const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring';

/**
 * @param {object} props
 * @param {object|null} props.row — display row (already merged with editedPayload when editing)
 * @param {boolean} [props.editable]
 * @param {(patch: object) => void} [props.onChange]
 * @param {() => void} [props.onBeginEdit] — set decision=edit + seed when opening from read-only
 * @param {() => void} props.onClose
 * @param {function} props.t
 */
export default function Gate2TcDetailPanel({
  row = null,
  editable = false,
  onChange = null,
  onBeginEdit = null,
  onClose,
  t,
}) {
  if (!row) return null;

  const missing = labelOf(t, 'requirements.qualityReviewMissing', 'Chưa có');
  const meta = [row.testLevel || row.level, row.testType, row.scenarioType, row.sourceUcKey]
    .filter(Boolean)
    .join(' · ');

  const objective = String(row.objective || '');
  const preconditions = asStringList(row.preconditions);
  const testData = asTestData(row.testData);
  const steps = asSteps(row.steps);
  const canPatch = editable && typeof onChange === 'function';

  const patch = (partial) => {
    if (!canPatch) return;
    onChange(partial);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate2-tc-detail-title"
      onClick={onClose}
    >
      <div
        className="vh-motion-respect flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-muted-foreground">{row.id || '—'}</p>
            <h2 id="gate2-tc-detail-title" className="truncate text-base font-semibold">
              {row.title || row.id || '—'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                meta,
                executionLabel(row, t),
                editable
                  ? labelOf(t, 'requirements.gate2TcDetailEditing', 'Đang sửa')
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            className="vh-motion-btn rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label={labelOf(t, 'common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
          {canPatch ? (
            <label className="block">
              <span className="font-medium text-foreground">
                {labelOf(t, 'requirements.qualityReviewObjective', 'Mục tiêu')}
              </span>
              <textarea
                className={FIELD_CLASS}
                rows={2}
                value={objective}
                onChange={(e) => patch({ objective: e.target.value })}
              />
            </label>
          ) : objective ? (
            <p className="text-sm text-foreground">{objective}</p>
          ) : null}

          {canPatch ? (
            <label className="block">
              <span className="font-medium text-foreground">
                {labelOf(t, 'requirements.qualityReviewPreconditions', 'Điều kiện tiền đề')}
              </span>
              <textarea
                className={FIELD_CLASS}
                rows={3}
                value={preconditions.join('\n')}
                placeholder={labelOf(
                  t,
                  'requirements.gate2TcDetailListHint',
                  'Mỗi dòng một mục'
                )}
                onChange={(e) =>
                  patch({
                    preconditions: e.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          ) : (
            <DetailList
              title={labelOf(t, 'requirements.qualityReviewPreconditions', 'Điều kiện tiền đề')}
              items={preconditions}
              empty={missing}
            />
          )}

          <div>
            <p className="font-medium text-foreground">
              {labelOf(t, 'requirements.qualityReviewData', 'Dữ liệu kiểm thử')}
            </p>
            {canPatch ? (
              <div className="mt-1 space-y-2">
                {testData.map((item, index) => (
                  <div key={`td-${index}`} className="grid grid-cols-2 gap-2">
                    <input
                      className={FIELD_CLASS}
                      value={item.field}
                      placeholder={labelOf(t, 'requirements.gate2TcDetailField', 'Field')}
                      onChange={(e) => {
                        const next = testData.map((rowItem, i) =>
                          i === index ? { ...rowItem, field: e.target.value } : rowItem
                        );
                        patch({ testData: next });
                      }}
                    />
                    <input
                      className={FIELD_CLASS}
                      value={item.value}
                      placeholder={labelOf(t, 'requirements.gate2TcDetailValue', 'Value')}
                      onChange={(e) => {
                        const next = testData.map((rowItem, i) =>
                          i === index ? { ...rowItem, value: e.target.value } : rowItem
                        );
                        patch({ testData: next });
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                  onClick={() => patch({ testData: [...testData, { field: '', value: '' }] })}
                >
                  {labelOf(t, 'requirements.gate2TcDetailAddData', 'Thêm dữ liệu')}
                </button>
              </div>
            ) : testData.length ? (
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {testData.map((item) => (
                  <li key={`${item.field}-${item.value}`}>
                    <span className="text-foreground">{item.field}</span>: {item.value}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">{missing}</p>
            )}
          </div>

          <div>
            <p className="font-medium text-foreground">
              {labelOf(t, 'requirements.qualityReviewSteps', 'Các bước')}
            </p>
            {canPatch ? (
              <div className="mt-1 space-y-3">
                {steps.map((step, index) => (
                  <div key={`step-${index}`} className="space-y-1 rounded-md border border-border/60 p-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {labelOf(t, 'requirements.qualityReviewSteps', 'Bước')} {index + 1}
                    </p>
                    <textarea
                      className={FIELD_CLASS}
                      rows={2}
                      value={step.action}
                      placeholder={labelOf(t, 'requirements.gate2TcDetailAction', 'Hành động')}
                      onChange={(e) => {
                        const next = steps.map((rowStep, i) =>
                          i === index
                            ? { ...rowStep, stepNo: i + 1, action: e.target.value }
                            : { ...rowStep, stepNo: i + 1 }
                        );
                        patch({ steps: next });
                      }}
                    />
                    <textarea
                      className={FIELD_CLASS}
                      rows={2}
                      value={step.expectedResult}
                      placeholder={labelOf(
                        t,
                        'requirements.qualityReviewExpected',
                        'Kết quả mong đợi'
                      )}
                      onChange={(e) => {
                        const next = steps.map((rowStep, i) =>
                          i === index
                            ? { ...rowStep, stepNo: i + 1, expectedResult: e.target.value }
                            : { ...rowStep, stepNo: i + 1 }
                        );
                        patch({ steps: next });
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                  onClick={() =>
                    patch({
                      steps: [
                        ...steps,
                        { stepNo: steps.length + 1, action: '', expectedResult: '' },
                      ],
                    })
                  }
                >
                  {labelOf(t, 'requirements.gate2TcDetailAddStep', 'Thêm bước')}
                </button>
              </div>
            ) : steps.length ? (
              <ol className="mt-1 space-y-2">
                {steps.map((step, index) => (
                  <li key={step.stepNo || index}>
                    <p className="text-foreground">
                      {step.stepNo || index + 1}. {step.action}
                    </p>
                    <p className="text-muted-foreground">
                      {labelOf(t, 'requirements.qualityReviewExpected', 'Kết quả mong đợi')}:{' '}
                      {step.expectedResult}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-muted-foreground">{missing}</p>
            )}
          </div>

          <p className="text-muted-foreground">
            {labelOf(t, 'requirements.qualityReviewSources', 'Nguồn')}:{' '}
            {(row.sourceRefs || []).map((ref) => `${ref.type} ${ref.id}`).join(' · ') || '—'}
          </p>

          {row.missingInformation ? (
            <p className="text-amber-800 dark:text-amber-200">{row.missingInformation}</p>
          ) : null}

          {row.scenarioType ? (
            <p className="text-muted-foreground">
              {labelOf(t, 'requirements.gate2ColScenarioType', 'Kịch bản')}: {row.scenarioType}
            </p>
          ) : null}
        </div>

        {!editable && typeof onBeginEdit === 'function' ? (
          <div className="border-t border-border px-4 py-3">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              onClick={onBeginEdit}
            >
              {labelOf(t, 'requirements.gate2TcDetailBeginEdit', 'Sửa chi tiết TC')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
