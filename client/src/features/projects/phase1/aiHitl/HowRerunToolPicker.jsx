import { useMemo, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import {
  HOW_REACT_CATALOG,
  howToolLabel,
  resolveHowRerunClosure,
} from './howRerunClosure';

/**
 * Selective HOW re-run: pick seed tools; dependents auto-included (preview).
 */
export default function HowRerunToolPicker({
  disabled = false,
  busy = false,
  onRerunFull,
  onRerunSelected,
  t,
}) {
  const [selected, setSelected] = useState(() => new Set());

  const closure = useMemo(
    () => resolveHowRerunClosure([...selected]),
    [selected]
  );
  const cascadeOnly = useMemo(
    () => closure.filter((n) => !selected.has(n)),
    [closure, selected]
  );

  const toggle = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const labelOf = (key, fallback) => {
    try {
      const v = typeof t === 'function' ? t(key) : null;
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-xs font-semibold text-foreground">
        {labelOf(
          'requirements.aiHitlHowRerunPickerTitle',
          'Chọn tool HOW chạy lại'
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {labelOf(
          'requirements.aiHitlHowRerunPickerHint',
          'Tool phụ thuộc sẽ chạy lại theo DAG. Phần không chọn giữ artifact/hash cũ.'
        )}
      </p>
      <ul className="mt-2 space-y-1.5">
        {HOW_REACT_CATALOG.map((name) => {
          const checked = selected.has(name);
          const cascaded = !checked && closure.includes(name);
          return (
            <li key={name} className="flex items-center gap-2 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border"
                  checked={checked}
                  disabled={disabled || busy}
                  onChange={() => toggle(name)}
                />
                <span className="font-medium text-foreground">
                  {howToolLabel(name)}
                </span>
                <span className="text-muted-foreground">({name})</span>
              </label>
              {cascaded ? (
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  {labelOf('requirements.aiHitlHowRerunCascade', 'cascade')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {cascadeOnly.length ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {labelOf('requirements.aiHitlHowRerunWillAlso', 'Cũng chạy lại')}:{' '}
          {cascadeOnly.map(howToolLabel).join(', ')}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy || !selected.size}
          onClick={() => onRerunSelected?.([...selected])}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          {labelOf(
            'requirements.aiHitlHowRerunSelected',
            'Chạy lại đã chọn'
          )}
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onRerunFull?.()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
          title={labelOf(
            'requirements.aiHitlRerunHowHint',
            'Chạy lại toàn bộ HOW — Gate 2 reset về PM'
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          {labelOf('requirements.aiHitlRerunHow', 'Chạy lại HOW (full)')}
        </button>
      </div>
    </div>
  );
}
