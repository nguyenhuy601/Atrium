import React from 'react';
import { useAppStrings } from '../../../../locales/appStrings';
import {
  formatCustomerRawContentWarnings,
  formatCustomerRawFormIssues,
  hasContentWarnings,
  isCustomerRawFormOk,
} from '../../../../utils/customerRawFormSummary';

/**
 * Customer Raw form check panel — sheets/headers gate + soft actor/behavior warnings.
 */
export default function CustomerRawFormPanel({ formValidation, className = '' }) {
  const { t } = useAppStrings();
  if (!formValidation) return null;

  const ok = isCustomerRawFormOk(formValidation);
  const issues = formatCustomerRawFormIssues(formValidation, t);
  const softWarnings = formatCustomerRawContentWarnings(formValidation, t);
  const warn = ok && hasContentWarnings(formValidation);

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        !ok
          ? 'border-destructive/40 bg-destructive/5 text-foreground'
          : warn
            ? 'border-amber-500/50 bg-amber-500/5 text-foreground'
            : 'border-emerald-500/40 bg-emerald-500/5 text-foreground'
      } ${className}`}
      data-testid="customer-raw-form-panel"
    >
      <p className="font-medium">
        {!ok
          ? t('workspace.phase1RawFormInvalid')
          : warn
            ? t('workspace.phase1RawFormOkWithWarnings') ||
              'Form template Raw: OK — có cảnh báo nội dung'
            : t('workspace.phase1RawFormOk')}
      </p>
      {ok ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('workspace.phase1RawFormOkHint') ||
            'Đủ sheet và cột theo Customer Requirement Raw. Nội dung từng dự án không bị ràng buộc quota.'}
        </p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {issues.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {softWarnings.length ? (
        <ul
          className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800 dark:text-amber-200"
          data-testid="customer-raw-content-warnings"
        >
          {softWarnings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {ok && Array.isArray(formValidation.presentSheets) && formValidation.presentSheets.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('workspace.phase1RawFormSheets').replace(
            '{list}',
            formValidation.presentSheets.join(', ')
          )}
        </p>
      ) : null}
    </div>
  );
}
