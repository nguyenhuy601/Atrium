import { Copy, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../../components/Shared/Modal';
import { useAppStrings } from '../../../../locales/appStrings';
import { statusBadgeClass, formatPhase1StatusLabel } from '../shared/phase1UiTokens';

function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '—';
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function docClassLabel(docClass, t) {
  const key = String(docClass || '').toLowerCase();
  if (key.includes('raw')) return t('workspace.phase1DocClassRaw');
  if (key.includes('analysis')) return t('workspace.phase1DocClassAnalysis');
  return String(docClass || '—').toUpperCase();
}

/**
 * Popup chi tiết 1 file Import Set — path MinIO / metadata (không hiện trên list).
 */
export default function ImportSetFileDetailModal({
  open,
  file = null,
  busy = false,
  onClose,
  onDownload,
}) {
  const { t } = useAppStrings();
  if (!open || !file) return null;

  const storageKey = String(file.storageKey || '').trim();

  const onCopyPath = async () => {
    if (!storageKey || !navigator?.clipboard?.writeText) {
      toast.error(t('workspace.phase1FileLibraryPathMissing'));
      return;
    }
    try {
      await navigator.clipboard.writeText(storageKey);
      toast.success(t('workspace.phase1FilePathCopied'));
    } catch {
      toast.error(t('workspace.phase1FileLibraryDownloadFail'));
    }
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted/40"
        onClick={onClose}
        disabled={busy}
      >
        {t('common.close')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDownload?.(file)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Download className="h-4 w-4" aria-hidden />
        {busy ? t('common.loading') : t('workspace.phase1FileLibraryDownload')}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('workspace.phase1FileDetailTitle')}
      size="sm"
      footer={footer}
      closable={!busy}
      headerClassName="items-start border-primary/30 bg-primary/5 dark:border-border dark:bg-surface"
      titleClassName="min-w-0 flex-1 pr-2 text-base font-semibold sm:text-base"
      bodyClassName="space-y-3 px-5 py-4"
      panelClassName="max-w-lg"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/5 text-primary">
          <FileSpreadsheet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-foreground dark:text-primary-foreground">
            {file.filename || '—'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {docClassLabel(file.docClass, t)}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatBytes(file.sizeBytes)}</span>
            {file.setStatus ? (
              <span className={statusBadgeClass(file.setStatus)}>
                {formatPhase1StatusLabel(file.setStatus, t)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 dark:border-border dark:bg-surface">
        {file.createdAt ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#8C8C8C]">
              {t('workspace.phase1FileFieldUploadedAt')}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground dark:text-muted-foreground">
              {new Date(file.createdAt).toLocaleString()}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#8C8C8C]">
            {t('workspace.phase1FileLibraryPathLabel')}
          </dt>
          {storageKey ? (
            <dd className="mt-1">
              <code className="block break-all rounded-lg border border-border bg-surface px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[#434343] dark:border-border dark:bg-surface dark:text-muted-foreground">
                {storageKey}
              </code>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40"
                onClick={() => void onCopyPath()}
              >
                <Copy className="h-3 w-3" aria-hidden />
                {t('workspace.phase1FileCopyPath')}
              </button>
            </dd>
          ) : (
            <dd className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
              {t('workspace.phase1FileLibraryPathMissing')}
            </dd>
          )}
        </div>
      </dl>
    </Modal>
  );
}
