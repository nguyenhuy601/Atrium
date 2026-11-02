import { useCallback, useEffect, useState } from 'react';
import { useAppStrings } from '../../../../locales/appStrings';
import projectAPI from '../../../../services/api/projectAPI';

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
    try {
      await projectAPI.scanExecutionControl(projectId, {});
      await load();
    } catch (err) {
      setError(err?.message || 'scan_failed');
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
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[10px]">
                  {JSON.stringify(detail.evidence || [], null, 2)}
                </pre>
              </section>
              <section>
                <h4 className="font-semibold">{t('workspace.executionControlGoalImpact')}</h4>
                <pre className="mt-1 rounded bg-muted/40 p-2 text-[10px]">
                  {JSON.stringify(detail.goalImpact || {}, null, 2)}
                </pre>
                <p className="mt-1 text-muted-foreground">
                  impactStatus: {detail.impactStatus || '—'} · intervention:{' '}
                  {detail.interventionLevel || '—'}
                </p>
              </section>
              <section>
                <h4 className="font-semibold">{t('workspace.executionControlProposals')}</h4>
                {(detail.proposals || []).length === 0 ? (
                  <p className="text-muted-foreground">{t('workspace.executionControlNoProposal')}</p>
                ) : (
                  (detail.proposals || []).map((p) => (
                    <div key={String(p._id)} className="mt-2 rounded border border-border p-2">
                      <p>
                        rev {p.proposalRevision} · {p.status}
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
                              remaining {p.situation.remainingHours ?? '—'}h · capacity{' '}
                              {p.situation.availableCapacityToDueHours ?? '—'}h · gap{' '}
                              {p.situation.gapHours}h · impact {p.situation.impactStatus}
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
                          <pre className="mt-1 max-h-28 overflow-auto rounded bg-muted/40 p-2 text-[10px]">
                            {JSON.stringify(p.evidenceRefs, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                      {Array.isArray(p.actions) && p.actions.length ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] font-medium">
                            {t('workspace.executionControlProposalActions')} (
                            {p.actions.length})
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                            {p.actions.map((a) => (
                              <li key={a.actionId || a.op}>
                                <span className="font-medium">{a.op}</span>
                                {String(a.op || '').startsWith('recommend_')
                                  ? ` — ${a.payload?.message || t('workspace.executionControlRecommendOnly')}`
                                  : ''}
                              </li>
                            ))}
                          </ul>
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
                <pre className="mt-1 rounded bg-muted/40 p-2 text-[10px]">
                  {JSON.stringify(detail.followUpResults || [], null, 2)}
                </pre>
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
