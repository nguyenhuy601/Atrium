import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import BrandPageLoader from './components/Shared/BrandPageLoader';
import SuiteShellLayout from './components/Layout/SuiteShellLayout';
import CommunicateSidebar from './components/Layout/CommunicateSidebar';
import CompanySuiteLayout from './components/Layout/CompanySuiteLayout';
import ProjectsSidebar from './components/Layout/ProjectsSidebar';
import AdminShellLayout from './components/Layout/AdminShellLayout';
import ManageShellLayout from './components/Layout/ManageShellLayout';
import LegacyWorkspaceRedirect from './components/Layout/LegacyWorkspaceRedirect';
import LegacyPathRedirect from './components/Layout/LegacyPathRedirect';
import LegacyAppPrefixRedirect from './components/Layout/LegacyAppPrefixRedirect';
import CollaborateLegacyRedirect from './components/Layout/CollaborateLegacyRedirect';
import RouteErrorBoundary from './components/Shared/RouteErrorBoundary';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';

/** Keep search when redirecting /projects/:projectId → overview. */
function ProjectIdToOverviewRedirect() {
  const { search } = useLocation();
  return <Navigate to={`overview${search || ''}`} replace />;
}

/** Strip org/from query when mapping legacy collaborate create URLs. */
function LegacyProjectsNewRedirect({ toBase }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search || '');
  params.delete('organizationId');
  params.delete('orgId');
  params.delete('from');
  const qs = params.toString();
  return <Navigate to={qs ? `${toBase}?${qs}` : toBase} replace />;
}

const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const MotionLabPage = import.meta.env.DEV
  ? lazy(() => import('./pages/Dev/MotionLabPage'))
  : null;

const RegisterRedirect = lazy(() => import('./components/Auth/RegisterRedirect'));
const VerifyEmailPage = lazy(() => import('./pages/Auth/VerifyEmailPage'));
const AcceptCompanyInvitePage = lazy(() => import('./pages/Auth/AcceptCompanyInvitePage'));
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/Auth/ResetPasswordPage'));
const TermsOfServicePage = lazy(() => import('./pages/Auth/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/Auth/PrivacyPolicyPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const DepartmentHomePage = lazy(() => import('./features/companyHome/DepartmentHomePage'));
const FriendChatPage = lazy(() => import('./pages/Chat/FriendChatPage'));
const VoiceRoomPage = lazy(() => import('./pages/Voice/VoiceRoomPage'));
const OrganizationsPage = lazy(() => import('./pages/Workspace/OrganizationsPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/Workspace/OrganizationSettingsPage'));
const CompanyAdminLayout = lazy(() => import('./pages/Admin/CompanyAdminLayout'));
const AdminHubPage = lazy(() => import('./pages/Admin/AdminHubPage'));
const AdminDomainPage = lazy(() => import('./pages/Admin/AdminDomainPage'));
const AdminLegacyRedirect = lazy(() => import('./components/Layout/AdminLegacyRedirect'));
const ApprovalInboxPage = lazy(() => import('./features/approvals/ApprovalInboxPage'));
const JoinApplicationPage = lazy(() => import('./pages/Workspace/JoinApplicationPage'));
const CreateProjectWizardPage = lazy(() => import('./pages/Projects/CreateProjectWizardPage'));
const CreateProjectAiWizardPage = lazy(() => import('./pages/Projects/CreateProjectAiWizardPage'));
const ProjectPickerPage = lazy(() => import('./features/projects/picker/ProjectPickerPage'));
const ProjectModuleRoute = lazy(() => import('./features/projects/hub/ProjectModuleRoute'));
const Phase1Shell = lazy(() => import('./features/projects/phase1/Phase1Shell'));
const NotificationsPage = lazy(() => import('./pages/Notifications/NotificationsPage'));
const CalendarPage = lazy(() => import('./pages/Calendar/CalendarPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFound/NotFoundPage'));
const SpaceChatModule = lazy(() => import('./features/spaceModules/SpaceChatModule'));
const SpaceCalendarModule = lazy(() => import('./features/spaceModules/SpaceCalendarModule'));
const SpaceDocumentsModule = lazy(() => import('./features/spaceModules/SpaceDocumentsModule'));

const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

function ProjectsSpaceTree() {
  return <SuiteShellLayout sidebar={<ProjectsSidebar />} />;
}

function App() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<BrandPageLoader />}>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        {MotionLabPage ? <Route path="/dev/motion-lab" element={<MotionLabPage />} /> : null}
        <Route path="/register" element={<RegisterRedirect />} />

        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email-change" element={<VerifyEmailPage />} />
        <Route path="/accept-company-invite" element={<AcceptCompanyInvitePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

        {/* Communicate suite */}
        <Route
          path="/communicate"
          element={
            <Protected>
              <SuiteShellLayout sidebar={<CommunicateSidebar />} />
            </Protected>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<DashboardPage suiteLayout suiteScope="communicate" />} />
          <Route path="chat/friends" element={<FriendChatPage suiteLayout />} />
          <Route path="voice" element={<VoiceRoomPage suiteLayout />} />
          <Route path="voice/:roomId" element={<VoiceRoomPage suiteLayout />} />
          <Route
            path="channels"
            element={<OrganizationsPage suiteMode="communicate" suiteLayout />}
          />
          <Route path="notifications" element={<NotificationsPage suiteLayout />} />
        </Route>

        {/* Full-screen project wizards */}
        <Route
          path="/projects/new"
          element={
            <Protected>
              <CreateProjectWizardPage />
            </Protected>
          }
        />
        <Route
          path="/projects/new-ai"
          element={
            <Protected>
              <CreateProjectAiWizardPage />
            </Protected>
          }
        />
        <Route
          path="/admin/projects/create"
          element={<Navigate to="/projects/new" replace />}
        />

        {/* Company Space suite */}
        <Route
          path="/company"
          element={
            <Protected>
              <CompanySuiteLayout />
            </Protected>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<DepartmentHomePage />} />
          <Route path="overview" element={<DashboardPage suiteLayout suiteScope="collaborate" />} />
          <Route
            path="workspaces"
            element={<OrganizationsPage suiteMode="collaborate" suiteLayout />}
          />
          <Route path="chat" element={<SpaceChatModule />} />
          <Route path="documents" element={<SpaceDocumentsModule />} />
          <Route path="calendar" element={<SpaceCalendarModule />} />
          <Route path="approvals" element={<ApprovalInboxPage suiteLayout />} />
          <Route path="notifications" element={<NotificationsPage orgScope suiteLayout />} />
          <Route path="organizations/:orgId/settings" element={<OrganizationSettingsPage suiteLayout />} />
          <Route path="join/:orgId" element={<JoinApplicationPage suiteLayout />} />
        </Route>

        {/* Projects suite */}
        <Route
          path="/projects"
          element={
            <Protected>
              <ProjectsSpaceTree />
            </Protected>
          }
        >
          <Route index element={<ProjectPickerPage />} />
          <Route path="requirements" element={<Navigate to="/projects" replace />} />
          <Route path=":projectId/planning/:planningModule/*" element={<Phase1Shell />} />
          {/* HITL path-tab — before :module so /ai-hitl/review is not swallowed */}
          <Route path=":projectId/ai-hitl/:hitlTab?" element={<Phase1Shell module="ai-hitl" />} />
          <Route path=":projectId/:module" element={<ProjectModuleRoute />} />
          <Route path=":projectId" element={<ProjectIdToOverviewRedirect />} />
        </Route>

        {/* Legacy Collaborate → dual suite (canonical + after /app strip) */}
        <Route
          path="/collaborate/projects/new"
          element={
            <Protected>
              <LegacyProjectsNewRedirect toBase="/projects/new" />
            </Protected>
          }
        />
        <Route
          path="/collaborate/projects/new-ai"
          element={
            <Protected>
              <LegacyProjectsNewRedirect toBase="/projects/new-ai" />
            </Protected>
          }
        />
        <Route
          path="/collaborate/*"
          element={
            <Protected>
              <CollaborateLegacyRedirect />
            </Protected>
          }
        />

        {/* Suite Quản trị — grant-gated (`/manage`), cùng panel với admin domains */}
        <Route
          path="/manage"
          element={
            <Protected>
              <ManageShellLayout />
            </Protected>
          }
        >
          <Route element={<CompanyAdminLayout />}>
            <Route index element={<AdminHubPage />} />
            <Route path="overview" element={<Navigate to="/manage" replace />} />
            <Route path="people" element={<Navigate to="/manage/users" replace />} />
            <Route path="approvals" element={<Navigate to="/manage/users" replace />} />
            <Route path="general" element={<Navigate to="/manage/system-config" replace />} />
            <Route path="structure" element={<Navigate to="/manage/system-config?tab=structure" replace />} />
            <Route path="roles" element={<Navigate to="/manage/rbac/roles" replace />} />
            <Route path="policy" element={<Navigate to="/manage/system-config/policy" replace />} />
            <Route path=":domain/*" element={<AdminDomainPage />} />
          </Route>
        </Route>

        {/* Admin hạ tầng — chỉ systemRole=admin; user grant bị redirect → /manage */}
        <Route
          path="/admin"
          element={
            <Protected>
              <AdminShellLayout />
            </Protected>
          }
        >
          <Route element={<CompanyAdminLayout />}>
            <Route index element={<AdminHubPage />} />
            <Route path="overview" element={<Navigate to="/admin" replace />} />
            <Route path="people" element={<Navigate to="/admin/users" replace />} />
            <Route path="approvals" element={<Navigate to="/admin/users" replace />} />
            <Route path="general" element={<Navigate to="/admin/system-config" replace />} />
            <Route path="structure" element={<Navigate to="/admin/system-config?tab=structure" replace />} />
            <Route path="roles" element={<Navigate to="/admin/rbac/roles" replace />} />
            <Route path="policy" element={<Navigate to="/admin/system-config/policy" replace />} />
            <Route path=":domain/*" element={<AdminDomainPage />} />
          </Route>
        </Route>

        <Route
          path="/me"
          element={
            <Protected>
              <SuiteShellLayout sidebar={<CommunicateSidebar />} />
            </Protected>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage suiteLayout suiteScope="me" />} />
          <Route path="calendar" element={<CalendarPage suiteLayout />} />
          <Route path="settings" element={<SettingsPage suiteLayout />} />
        </Route>

        {/* Legacy redirects (pre-suite + pre-/app-removal) */}
        <Route path="/dashboard" element={<Navigate to="/communicate/overview" replace />} />
        <Route path="/calendar" element={<Navigate to="/me/calendar" replace />} />
        <Route path="/settings" element={<Navigate to="/me/settings" replace />} />
        <Route path="/profile" element={<Navigate to="/me/dashboard" replace />} />
        <Route path="/chat" element={<Navigate to="/communicate/chat/friends" replace />} />
        <Route path="/chat/friends" element={<Navigate to="/communicate/chat/friends" replace />} />
        <Route path="/chat/organization" element={<Navigate to="/company/workspaces" replace />} />
        <Route path="/voice" element={<Navigate to="/communicate/voice" replace />} />
        <Route
          path="/voice/:roomId"
          element={<LegacyPathRedirect toTemplate="/communicate/voice/:roomId" />}
        />
        <Route path="/friends" element={<Navigate to="/communicate/chat/friends" replace />} />
        <Route path="/notifications" element={<Navigate to="/communicate/notifications" replace />} />
        <Route path="/notifications/organization" element={<Navigate to="/company/notifications" replace />} />
        <Route path="/documents" element={<Navigate to="/company/documents" replace />} />
        <Route path="/tasks" element={<Navigate to="/projects" replace />} />
        <Route path="/organizations" element={<Navigate to="/company/workspaces" replace />} />
        <Route path="/workspaces" element={<Navigate to="/company/workspaces" replace />} />
        <Route
          path="/organizations/join/:orgId"
          element={<LegacyPathRedirect toTemplate="/company/join/:orgId" />}
        />
        <Route
          path="/organizations/:orgId/settings"
          element={<LegacyPathRedirect toTemplate="/company/organizations/:orgId/settings" />}
        />
        <Route
          path="/workspaces/join/:orgId"
          element={<LegacyPathRedirect toTemplate="/company/join/:orgId" />}
        />
        <Route
          path="/workspaces/:orgId/settings"
          element={<LegacyPathRedirect toTemplate="/company/organizations/:orgId/settings" />}
        />
        <Route
          path="/w/:slug/*"
          element={
            <Protected>
              <LegacyWorkspaceRedirect />
            </Protected>
          }
        />

        {/* Legacy /app prefix — after canonical routes so /app/* strip wins for bookmarks */}
        <Route
          path="/app"
          element={
            <Protected>
              <LegacyAppPrefixRedirect />
            </Protected>
          }
        />
        <Route
          path="/app/*"
          element={
            <Protected>
              <LegacyAppPrefixRedirect />
            </Protected>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
}

export default App;
