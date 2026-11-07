import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { User } from 'lucide-react';
import UserAvatar from '../../../components/Shared/UserAvatar';
import MotionPresence from '../../../motion/primitives/MotionPresence';
import { motionPopover } from '../../../motion/overlayMotion';
import { VH_MOTION_BTN, VH_MOTION_FIELD, VH_MOTION_ROW } from '../../../motion/classes';

/**
 * Ô Assignee trên List: click → gõ tìm → gợi ý thành viên dự án / board.
 * Trigger + MotionPresence luôn mount cùng cây — tránh remount nuốt enter/exit.
 */
export default function ProjectHubListAssigneeCell({
  assignee = null,
  members = [],
  membersLoading = false,
  canEdit = false,
  busy = false,
  t,
  onAssign,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(members) ? members : [];
    if (!q) return list;
    return list.filter((m) => {
      const name = String(m.name || '').toLowerCase();
      const username = String(m.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [members, query]);

  if (!canEdit) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {assignee?.name ? (
          <>
            <UserAvatar
              avatar={assignee.avatar}
              userId={assignee.userId}
              name={assignee.name}
              size="xs"
            />
            <span className="truncate">{assignee.name}</span>
          </>
        ) : (
          <span className="truncate">—</span>
        )}
      </div>
    );
  }

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${open ? 'z-30' : ''}`}>
      {open ? (
        <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-1.5 shadow-sm">
          <User size={14} className="shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            className={`min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 ${VH_MOTION_FIELD}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('workspace.projectHubListAssigneeSearchPh')}
            aria-label={t('workspace.projectHubListAssigneeSearchPh')}
            aria-autocomplete="list"
            aria-expanded
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeMenu();
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          className={`flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${VH_MOTION_BTN}`}
          aria-label={t('workspace.projectHubListAssigneeAria')}
          aria-expanded={false}
          aria-haspopup="listbox"
          onClick={() => setOpen(true)}
        >
          {assignee?.name ? (
            <>
              <UserAvatar
                avatar={assignee.avatar}
                userId={assignee.userId}
                name={assignee.name}
                size="xs"
              />
              <span className="truncate">{assignee.name}</span>
            </>
          ) : (
            <>
              <User size={14} className="shrink-0 opacity-60" aria-hidden />
              <span className="truncate">{t('taskBoard.unassigned')}</span>
            </>
          )}
        </button>
      )}

      <MotionPresence open={open} initial>
        <motion.ul
          key="assignee-listbox"
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-48 w-[min(16rem,70vw)] origin-top overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
          initial={motionPopover.initial}
          animate={motionPopover.animate}
          exit={motionPopover.exit}
          transition={motionPopover.transition}
        >
          {membersLoading ? (
            <li className="px-2.5 py-1.5 text-xs text-muted-foreground">
              {t('taskBoard.loadingBoardMembers')}
            </li>
          ) : (
            <>
              <li role="option">
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VH_MOTION_ROW}`}
                  disabled={busy}
                  onClick={() => {
                    onAssign?.(null);
                    closeMenu();
                  }}
                >
                  <User size={14} className="shrink-0 opacity-60" aria-hidden />
                  <span>{t('workspace.projectHubListAssigneeAutomatic')}</span>
                </button>
              </li>
              {filtered.length === 0 ? (
                <li className="px-2.5 py-1.5 text-xs text-muted-foreground">
                  {t('workspace.projectHubListAssigneeNoMatch')}
                </li>
              ) : (
                filtered.map((m) => (
                  <li key={m.id} role="option">
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VH_MOTION_ROW}`}
                      disabled={busy}
                      onClick={() => {
                        onAssign?.(m);
                        closeMenu();
                      }}
                    >
                      <UserAvatar avatar={m.avatarUrl || ''} userId={m.id} name={m.name} size="xs" />
                      <span className="truncate text-foreground">{m.name}</span>
                    </button>
                  </li>
                ))
              )}
            </>
          )}
        </motion.ul>
      </MotionPresence>
    </div>
  );
}
