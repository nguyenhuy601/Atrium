import { useCallback, useEffect, useState } from 'react';
import { useAppStrings } from '../../../../locales/appStrings';
import projectAPI from '../../../../services/api/projectAPI';
import {
  EvidenceList,
  FollowUpResultsList,
  GoalImpactBlock,
  ProposalActionsList,
  ProposalEvidenceRefs,
} from './executionControlDisplay';

/**
 * Control Tower MVP — issue → evidence → goal impact → proposal → approve → follow-up.
 */
export default function ProjectHubExecutionControlPanel({ projectId, listActive = true }) {
  const { t } = useAppStrings();
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', kind: 'other' });
  const [busy, setBusy] = useState(false);
  const [scanSummary, setScanSummary] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !listActive) return;
    setLoading(true);
    setError('');
    try {
      const [issRes, riskRes] = await Promise.all([
        projectAPI.listExecutionIssues(projectId),
        projectAPI.listExecutionRisks(projectId),
      ]);
      setIssues(issRes?.data?.data || issRes?.data || []);
      setRisks(riskRes?.data?.data || riskRes?.data || []);
    } catch (e) {
      setError(e?.message || 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [projectId, listActive]);

  useEffect(() => {
    load();
  }, [load]);

  const openIssue = async (id) => {
    setSelected(id);
    try {
      const res = await projectAPI.getExecutionIssue(projectId, id, { view: 'full' });
      setDetail(res?.data?.data || res?.data || null);
    } catch (e) {
      setError(e?.message || 'detail_failed');
    }
  };

  const decide = async (proposalId, decision) => {
    setBusy(true);
    try {
      await projectAPI.decideExecutionProposal(projectId, proposalId, { decision });
      await openIssue(selected);
      await load();
    } catch (e) {
      setError(e?.message || 'decide_failed');
    } finally {
      setBusy(false);
    }
  };

  const submitIncident = async (e) => {
    e.preventDefault();
    if (!incidentForm.title.trim()) return;
    setBusy(true);
    try {
      await projectAPI.createExecutionIncident(projectId, incidentForm);
      setIncidentForm({ title: '', description: '', kind: 'other' });
      await load();
    } catch (err) {
      setError(err?.message || 'incident_failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmRisk = async (riskId) => {
    setBusy(true);
    try {
      await projectAPI.confirmExecutionRiskOccurred(projectId, riskId, {});
      await load();
    } catch (err) {
      setError(err?.message || 'risk_failed');
    } finally {
      setBusy(false);
    }
  };

  const runScan = async () => {
    setBusy(true);
    setScanSummary('');
    try {
      // defaultCapacityToDue cho phép AT_RISK khi remaining đã confirm > capacity.
      const res = await projectAPI.scanExecutionControl(projectId, {
        defaultCapacityToDue: 8,
      });
      const payload = res?.data?.data || res?.data || {};
      const scanned = Number(payload.scanned) || 0;
      const withIssues = Array.isArray(payload.results)
        ? payload.results.filter((r) => (r?.issues || []).length > 0).length
        : 0;
      setScanSummary(`Đã quét ${scanned} task · ${withIssues} có issue`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.messageUser || err?.message || 'scan_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">
          {t('workspace.projectHubTabExecutionControl')}
        </h3>
        <button
          type="button"
          className="vh-motion-btn rounded-md border border-border px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={runScan}
        >
          {t('workspace.executionControlScan')}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {scanSummary ? (
        <p className="text-xs text-muted-foreground" data-testid="execution-control-scan-summary">
          {scanSummary}
        </p>
      ) : null}
      {loading ? <p className="text-xs text-muted-foreground">…</p> : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-md border border-border p-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t('workspace.executionControlIssues')}
          </p>
          {(issues || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('workspace.executionControlEmpty')}</p>
          ) : (
            <ul className="space-y-1">
              {issues.map((iss) => (
                <li key={String(iss._id)}>
                  <button
                    type="button"
                    className={`vh-motion-row w-full rounded px-2 py-1.5 text-left text-xs ${
                      selected === String(iss._id) ? 'bg-muted' : ''
                    }`}
                    onClick={() => openIssue(String(iss._id))}
                  >
                    <span className="font-medium">{iss.kind}</span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span>{iss.status}</span>
                    <div className="truncate text-muted-foreground">{iss.title}</div>
                    {iss.needsData ? (
                      <span className="text-[10px] text-amber-700">NEEDS_DATA</span>
                    ) : null}
                    {iss.impactStatus && iss.impactStatus !== 'FULL' ? (
                      <span className="ml-1 text-[10px] text-amber-700">{iss.impactStatus}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {t('workspace.executionControlRisks')}
          </p>
          <ul className="space-y-1">
            {(risks || []).map((r) => (
              <li
                key={String(r._id)}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
              >
                <span className="truncate">
                  {r.title} <span className="text-muted-foreground">({r.status})</span>
                </span>
                {r.status !== 'occurred' && r.status !== 'closed' ? (
                  <button
                    type="button"
                    className="vh-motion-btn shrink-0 rounded border border-border px-2 py-0.5"
                    disabled={busy}
                    onClick={() => confirmRisk(String(r._id))}
                  >
                    {t('workspace.executionControlConfirmRisk')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          <form onSubmit={submitIncident} className="mt-3 space-y-1 border-t border-border pt-2">
            <p className="text-xs font-semibold">{t('workspace.executionControlReportIncident')}</p>
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              placeholder={t('workspace.executionControlIncidentTitle')}
              value={incidentForm.title}
              onChange={(ev) => setIncidentForm((s) => ({ ...s, title: ev.target.value }))}
            />
            <textarea
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              rows={2}
              placeholder={t('workspace.executionControlIncidentDesc')}
              value={incidentForm.description}
              onChange={(ev) => setIncidentForm((s) => ({ ...s, description: ev.target.value }))}
            />
            <button
              type="submit"
              className="vh-motion-btn rounded-md border border-border px-3 py-1 text-xs"
              disabled={busy}
            >
              {t('workspace.executionControlSubmitIncident')}
            </button>
          </form>
        </div>

        <div className="min-h-0 overflow-y-auto rounded-md border border-border p-3 text-xs">
          {!detail ? (
            <p className="text-muted-foreground">{t('workspace.executionControlSelectIssue')}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-semibold">{detail.title}</p>
                <p className="text-muted-foreground">
                  {detail.kind} · {detail.status}
                  {detail.graphRunStatus ? ` · graph:${detail.graphRunStatus}` : ''}
                </p>
              </div>
              <section>
                <h4 className="font-semibold">{t('workspace.executionControlEvidence')}</h4>
                <EvidenceList
                  evidence={detail.evidence}
                  t={t}
                  emptyLabel={t('workspace.executionControlEvidenceEmpty')}
                />
              </section>
              <section>
                <h4 className="font-semibold">{t('workspace.executionControlGoalImpact')}</h4>
                <GoalImpactBlock
                  goalImpact={detail.goalImpact}
                  impactStatus={detail.impactStatus}
                  interventionLevel={detail.interventionLevel}
                  t={t}
                />
              </section>
              <section>
                <h4 className="font-semibold">{t('workspace.executionControlProposals')}</h4>
                {(detail.proposals || []).length === 0 ? (
                  <p className="text-muted-foreground">{t('workspace.executionControlNoProposal')}</p>
                ) : (
                  (detail.proposals || []).map((p) => (
                    <div key={String(p._id)} className="mt-2 rounded border border-border p-2">
                      <p>
                        {t('workspace.executionControlProposalRev', {
                          rev: p.proposalRevision ?? '—',
                        })}{' '}
                        · {p.status}
                        {p.interventionLevel ? ` · ${p.interventionLevel}` : ''}
                      </p>
                      {p.situation?.narrativeLines?.length ? (
                        <div className="mt-1 space-y-1">
                          <p className="font-medium">
                            {t('workspace.executionControlSituation')}
                          </p>
                          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                            {p.situation.narrativeLines.map((line, idx) => (
                              <li key={`${p._id}-n-${idx}`}>{line}</li>
                            ))}
                          </ul>
                          {p.situation.gapHours != null ? (
                            <p className="text-[11px] text-muted-foreground">
                              {t('workspace.executionControlSituationMetrics', {
                                remaining: p.situation.remainingHours ?? '—',
                                capacity: p.situation.availableCapacityToDueHours ?? '—',
                                gap: p.situation.gapHours,
                                impact: p.situation.impactStatus || '—',
                              })}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">{p.summary || '—'}</p>
                      )}
                      {Array.isArray(p.evidenceRefs) && p.evidenceRefs.length ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] font-medium">
                            {t('workspace.executionControlProposalEvidence')}
                          </summary>
                          <ProposalEvidenceRefs refs={p.evidenceRefs} t={t} />
                        </details>
                      ) : null}
                      {Array.isArray(p.actions) && p.actions.length ? (
                        <details className="mt-1" open>
                          <summary className="cursor-pointer text-[11px] font-medium">
                            {t('workspace.executionControlProposalActions')} (
                            {p.actions.length})
                          </summary>
                          <ProposalActionsList actions={p.actions} t={t} />
                        </details>
                      ) : null}
                      {p.status === 'pending_approval' ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="vh-motion-btn rounded border border-border px-2 py-1"
                            disabled={busy}
                            onClick={() => decide(String(p._id), 'approved')}
                          >
                            {t('workspace.executionControlApprove')}
                          </button>
                          <button
                            type="button"
                            className="vh-motion-btn rounded border border-border px-2 py-1"
                            disabled={busy}
                            onClick={() => decide(String(p._id), 'rejected')}
                          >
                            {t('workspace.executionControlReject')}
                          </button>
                        </div>
                      ) : null}
                      {p.status === 'invalidated' ? (
                        <p className="mt-1 text-amber-700">
                          {t('workspace.executionControlProposalInvalidated')}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </section>
              <section>
                <h4 className="font-semibold">{t('workspace.executionControlFollowUp')}</h4>
                <FollowUpResultsList
                  results={detail.followUpResults}
                  t={t}
                  emptyLabel={t('workspace.executionControlFollowUpEmpty')}
                />
                <button
                  type="button"
                  className="vh-motion-btn mt-2 rounded border border-border px-2 py-1"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await projectAPI.runExecutionFollowUp(projectId, selected);
                      await openIssue(selected);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('workspace.executionControlRunFollowUp')}
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
