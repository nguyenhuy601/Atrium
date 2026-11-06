import { FIGMA_DASH_THREE_COL, FIGMA_DASH_TWO_COL } from './figmaDashboardClasses';
import DashboardRecentMessages from './DashboardRecentMessages';
import DashboardUpcomingMeetings from './DashboardUpcomingMeetings';
import DashboardWorkspacesPanel from './DashboardWorkspacesPanel';

export default function DashboardBottomRow({
  messages,
  meetings,
  meetingsEmptyLabel,
  workspaces,
  hideWorkspacesPanel = false,
  onMessagesViewAll,
  onMessageClick,
  onCalendarClick,
  onMeetingClick,
  onCreateRoom,
  onWorkspacesViewAll,
  onWorkspaceClick,
  onCreateWorkspace,
}) {
  return (
    <div className={hideWorkspacesPanel ? FIGMA_DASH_TWO_COL : FIGMA_DASH_THREE_COL}>
      <DashboardRecentMessages
        messages={messages}
        onViewAll={onMessagesViewAll}
        onMessageClick={onMessageClick}
      />
      <DashboardUpcomingMeetings
        meetings={meetings}
        emptyLabel={meetingsEmptyLabel}
        onViewCalendar={onCalendarClick}
        onMeetingClick={onMeetingClick}
        onCreateRoom={onCreateRoom}
      />
      {!hideWorkspacesPanel && (
        <DashboardWorkspacesPanel
          workspaces={workspaces}
          onViewAll={onWorkspacesViewAll}
          onWorkspaceClick={onWorkspaceClick}
          onCreateWorkspace={onCreateWorkspace}
        />
      )}
    </div>
  );
}
