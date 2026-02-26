import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useSocket } from '@/hooks/useSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ChatPage } from '@/pages/ChatPage';
import { TeamsPage } from '@/pages/TeamsPage';
import { TeamDetailPage } from '@/pages/TeamDetailPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { TasksPage } from '@/pages/TasksPage';
import { ActivityPage } from '@/pages/ActivityPage';
import { AgentChatPage } from '@/pages/AgentChatPage';
import { OrganizationPage } from '@/pages/OrganizationPage';
import { FilesPage } from '@/pages/FilesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SkillsPage } from '@/pages/SkillsPage';
import { LogsPage } from '@/pages/LogsPage';
import { ExtensionsPage } from '@/pages/ExtensionsPage';
import { ChannelsPage } from '@/pages/ChannelsPage';
import { MemoryPage } from '@/pages/MemoryPage';
import { CronPage } from '@/pages/CronPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { AdminFeedbackPage } from '@/pages/AdminFeedbackPage';

// Detect if running inside Electron desktop shell
const isDesktop = !!(window as any).electronAPI?.isDesktop;

function AuthenticatedApp() {
  useSocket();

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="agent-chat" element={<AgentChatPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="teams/:id" element={<TeamDetailPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="extensions" element={<ExtensionsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="memory" element={<MemoryPage />} />
        <Route path="cron" element={<CronPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="admin/feedback" element={<AdminFeedbackPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { isAuthenticated, restoreSession, desktopLogin } = useAuthStore();

  useEffect(() => {
    if (isDesktop) {
      // Desktop mode: auto-login without credentials
      desktopLogin();
    } else {
      restoreSession();
    }
  }, [restoreSession, desktopLogin]);

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <AuthenticatedApp />
      ) : (
        <Routes>
          {isDesktop ? (
            // Desktop mode: show loading while auto-login completes
            <Route path="*" element={
              <div className="flex items-center justify-center h-screen bg-background text-text-primary">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-text-secondary">Starting Workspace AI...</p>
                </div>
              </div>
            } />
          ) : (
            <Route path="*" element={<LoginPage />} />
          )}
        </Routes>
      )}
    </BrowserRouter>
  );
}
