import { useMemo, useState } from 'react';
import {
  formatAuditWhen,
  formatEditorLabel,
  hasSideAudit,
  openLineConflictCount,
  readGate2LineConflicts,
  readGate2SynthesisDraft,
  resolvedLineConflictCount,
  summarizeSideAction,
  synthesisDecisionEntries,
} from './gate2LineConflict.js';

function labelOf(t, key, fallback, vars) {
  const value = typeof t === 'function' ? t(key, vars) : '';
  if (value && value !== key) return value;
  if (!vars) return fallback;
  return Object.entries(vars).reduce(
    (text, [name, raw]) => text.replace(`{${name}}`, String(raw ?? '')),
    fallback
  );
}

function FilterChips({ filter, setFilter, t }) {
  const items = [
    { key: 'all', label: labelOf(t, 'requirements.gate2SynthFilterAll', 'Tất cả') },
    { key: 'open', label: labelOf(t, 'requirements.gate2SynthFilterOpen', 'Conflict') },
    { key: 'resolved', label: labelOf(t, 'requirements.gate2SynthFilterResolved', 'Đã chốt') },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setFilter(item.key)}
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            filter === item.key
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SideCell({ side, nameByUserId, t, onChoose, busy, canChoose }) {
  const auditOk = hasSideAudit(side);
  const disabled = busy || !canChoose || !auditOk;
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-foreground">
        {labelOf(t, 'requirements.gate2SynthVersion', 'Bản {version}', {
          version: side?.versionLabel || '—',
        })}{' '}
        · {side?.roleKey || '—'}
      </p>
      <p className="text-muted-foreground">{summarizeSideAction(side)}</p>
      <p className="text-[11px] text-muted-foreground">
        {labelOf(
          t,
          'requirements.gate2SynthSideAudit',
          'Sửa bởi {editor} · {when} · phiên bản {version}',
          {
            editor: formatEditorLabel(side, nameByUserId),
            when: formatAuditWhen(side),
            version: side?.versionLabel || '—',
          }
        )}
      </p>
      {canChoose ? (
        <button
          type="button"
          disabled={disabled}
          title={
            auditOk
              ? undefined
              : labelOf(
                  t,
                  'requirements.gate2SynthMissingAudit',
                  'Thiếu audit phiên bản / người sửa — không thể chọn'
                )
          }
          onClick={() => onChoose?.(side?.roleKey)}
          className="mt-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {labelOf(t, 'requirements.gate2SynthChooseVersion', 'Chọn bản {version}', {
            version: side?.versionLabel || '',
          })}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Synthesis view: conflict rows (A/B choose) + consolidated table with mandatory audit columns.
 */
export default function Gate2SynthesisConflictPanel({
  pack = null,
  busy = false,
  t,
  nameByUserId = {},
  synthesisLabel = 'PM',
  onResolveLineConflict,
  onConfirmPlan,
  confirmDisabledExtra = false,
}) {
  const [filter, setFilter] = useState('all');
  const lineConflicts = useMemo(() => readGate2LineConflicts(pack), [pack]);
  const synthesisDraft = useMemo(() => readGate2SynthesisDraft(pack), [pack]);
  const openCount = openLineConflictCount(lineConflicts);
  const resolvedCount = resolvedLineConflictCount(lineConflicts);
  const agreedCount = synthesisDecisionEntries(synthesisDraft).length;
  const roleVars = { synthesis: synthesisLabel };

  const visibleConflicts = useMemo(() => {
    if (filter === 'open') return lineConflicts.filter((row) => row.status === 'open');
    if (filter === 'resolved') return lineConflicts.filter((row) => row.status === 'resolved');
    return lineConflicts;
  }, [filter, lineConflicts]);

  const draftRows = useMemo(() => synthesisDecisionEntries(synthesisDraft), [synthesisDraft]);
  const confirmBlocked = openCount > 0 || confirmDisabledExtra || busy;

  return (
    <section className="mb-4 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {labelOf(t, 'requirements.gate2SynthTitle', 'Bản tổng hợp ({synthesis})', roleVars)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {labelOf(
              t,
              'requirements.gate2SynthSummary',
              'Đã thống nhất: {agreed} · Conflict mở: {open} · Đã chốt conflict: {resolved}',
              { agreed: agreedCount, open: openCount, resolved: resolvedCount }
            )}
          </p>
        </div>
        <FilterChips filter={filter} setFilter={setFilter} t={t} />
      </div>

      {openCount > 0 ? (
        <div className="overflow-x-auto rounded-md border border-amber-300/60 dark:border-amber-700/50">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-amber-50/80 dark:bg-amber-950/40">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 font-medium">
                  {labelOf(t, 'requirements.gate2SynthColLine', 'Dòng')}
                </th>
                <th className="px-2 py-2 font-medium">
                  {labelOf(t, 'requirements.gate2SynthColSection', 'Section')}
                </th>
                <th className="px-2 py-2 font-medium">
                  {labelOf(t, 'requirements.gate2SynthColSides', 'Các bản')}
                </th>
                <th className="px-2 py-2 font-medium">
                  {labelOf(t, 'requirements.gate2SynthColStatus', 'Trạng thái')}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleConflicts.map((row) => {
                const isOpen = String(row.status || '') === 'open';
                return (
                  <tr
                    key={row.id}
                    data-conflict={isOpen ? '1' : undefined}
                    className={`border-t border-border align-top ${
                      isOpen ? 'bg-amber-50/60 dark:bg-amber-950/25' : 'bg-background'
                    }`}
                  >
                    <td className="px-2 py-2 font-medium text-foreground">{row.logicalId}</td>
                    <td className="px-2 py-2 text-muted-foreground">{row.sectionKey || '—'}</td>
                    <td className="px-2 py-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(row.sides || []).map((side) => (
                          <SideCell
                            key={`${row.id}:${side.roleKey}`}
                            side={side}
                            nameByUserId={nameByUserId}
                            t={t}
                            busy={busy}
                            canChoose={isOpen}
                            onChoose={(roleKey) =>
                              onResolveLineConflict?.({
                                conflictId: row.id,
                                chosenRoleKey: roleKey,
                              })
                            }
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {isOpen
                        ? labelOf(t, 'requirements.gate2SynthStatusOpen', 'Chưa chốt')
                        : labelOf(
                            t,
                            'requirements.gate2SynthStatusResolved',
                            'Đã chốt · theo bản {version} ({role}) · người sửa gốc {editor} · chốt bởi {resolver}',
                            {
                              version: row.chosenVersionLabel || '—',
                              role: row.chosenRoleKey || '—',
                              editor: formatEditorLabel(
                                (row.sides || []).find((s) => s.roleKey === row.chosenRoleKey),
                                nameByUserId
                              ),
                              resolver: formatEditorLabel(
                                { editedBy: row.resolvedBy },
                                nameByUserId
                              ),
                            }
                          )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {labelOf(
            t,
            'requirements.gate2SynthNoConflicts',
            'Không có conflict dòng — chỉ bảng tổng hợp bên dưới.'
          )}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 font-medium">
                {labelOf(t, 'requirements.gate2SynthColLine', 'Dòng')}
              </th>
              <th className="px-2 py-2 font-medium">
                {labelOf(t, 'requirements.gate2SynthColSource', 'Nguồn')}
              </th>
              <th className="px-2 py-2 font-medium">
                {labelOf(t, 'requirements.gate2SynthColVersion', 'Phiên bản')}
              </th>
              <th className="px-2 py-2 font-medium">
                {labelOf(t, 'requirements.gate2SynthColEditor', 'Người sửa')}
              </th>
              <th className="px-2 py-2 font-medium">
                {labelOf(t, 'requirements.gate2SynthColWhen', 'Lúc')}
              </th>
              <th className="px-2 py-2 font-medium">
                {labelOf(t, 'requirements.gate2SynthColAction', 'Quyết định')}
              </th>
            </tr>
          </thead>
          <tbody>
            {draftRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-muted-foreground">
                  {labelOf(
                    t,
                    'requirements.gate2SynthDraftEmpty',
                    'Chưa có dòng tự đồng thuận — xử lý conflict phía trên trước.'
                  )}
                </td>
              </tr>
            ) : (
              draftRows.map((row) => (
                <tr key={row.logicalId} className="border-t border-border align-top">
                  <td className="px-2 py-2 font-medium text-foreground">{row.logicalId}</td>
                  <td className="px-2 py-2 text-muted-foreground">{row.source || '—'}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {row.versionLabel || 'C'}
                    {row.chosenFromVersionLabel
                      ? ` ← ${row.chosenFromVersionLabel}`
                      : ''}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {row.sourceEditedBy
                      ? formatEditorLabel({ editedBy: row.sourceEditedBy }, nameByUserId)
                      : '—'}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatAuditWhen({
                      editedAt: row.sourceEditedAt || row.resolvedAt,
                    })}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {summarizeSideAction(row)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {typeof onConfirmPlan === 'function' ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={confirmBlocked}
            onClick={() => onConfirmPlan()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {labelOf(t, 'requirements.gate2PmConfirmPlan', 'Xác nhận kế hoạch đã nhất quán')}
          </button>
          {openCount > 0 ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {labelOf(
                t,
                'requirements.gate2SynthConfirmBlocked',
                'Còn {count} dòng conflict chưa chốt.',
                { count: openCount }
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
