import { useId, useRef } from 'react';
import TabIndicator from '../../motion/primitives/TabIndicator';
import TabPanelMotion from '../../motion/primitives/TabPanelMotion';

/**
 * Tablist dùng chung cho hub admin (roving tabindex, Arrow/Home/End, cuộn ngang trên mobile).
 * Indicator trượt (Motion layoutId) + panel fade khi đổi tab.
 * Trả null khi chỉ có ≤ 1 tab; `AdminHubTabPanel` tự bỏ role tabpanel trong trường hợp đó.
 */
export function useAdminHubTabIds() {
  return `hub-${useId().replace(/:/g, '')}`;
}

export function AdminHubTablist({ idPrefix, label, tabs, activeTab, onSelect, className = '' }) {
  const tabRefs = useRef({});
  const indicatorLayoutId = `vh-admin-tab-${idPrefix}`;
  if (tabs.length <= 1) return null;

  const focusTabAt = (index) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    if (!next) return;
    onSelect(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const handleKeyDown = (event) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (event.key === 'ArrowRight') focusTabAt(currentIndex + 1);
    else if (event.key === 'ArrowLeft') focusTabAt(currentIndex - 1);
    else if (event.key === 'Home') focusTabAt(0);
    else if (event.key === 'End') focusTabAt(tabs.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className={`flex shrink-0 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 ${className}`}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      data-testid="admin-hub-tablist"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={[
              'relative shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium vh-motion-btn motion-reduce:transform-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active ? 'text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary-subtle hover:text-foreground',
            ].join(' ')}
          >
            {active ? <TabIndicator layoutId={indicatorLayoutId} /> : null}
            <span className="relative z-[1]">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AdminHubTabPanel({ idPrefix, tabs, activeTab, className, children }) {
  const hasTablist = tabs.length > 1;
  return (
    <div
      id={`${idPrefix}-panel`}
      role={hasTablist ? 'tabpanel' : undefined}
      aria-labelledby={hasTablist ? `${idPrefix}-tab-${activeTab}` : undefined}
      className={className}
    >
      <TabPanelMotion activeKey={activeTab}>{children}</TabPanelMotion>
    </div>
  );
}
