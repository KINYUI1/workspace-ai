import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Users,
  ListTodo,
  Activity,
  Settings,
  LogOut,
  Bot,
  Building2,
  FileText,
  Puzzle,
  ScrollText,
  Blocks,
  Radio,
  Brain,
  Clock,
  MessageSquarePlus,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const ADMIN_EMAIL = 'ndiclementkinyui@gmail.com';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/agent-chat', icon: MessagesSquare, label: 'Agent Chat' },
  { path: '/organization', icon: Building2, label: 'Organization' },
  { path: '/teams', icon: Users, label: 'Teams' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/tasks', icon: ListTodo, label: 'Tasks' },
  { path: '/files', icon: FileText, label: 'Files' },
  { path: '/skills', icon: Puzzle, label: 'Skills' },
  { path: '/extensions', icon: Blocks, label: 'Extensions' },
  { path: '/channels', icon: Radio, label: 'Channels' },
  { path: '/memory', icon: Brain, label: 'Memory' },
  { path: '/logs', icon: ScrollText, label: 'Logs' },
  { path: '/cron', icon: Clock, label: 'Cron Jobs' },
  { path: '/feedback', icon: MessageSquarePlus, label: 'Feedback' },
  { path: '/activity', icon: Activity, label: 'Activity' },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary">Workspace AI</h1>
          <p className="text-xs text-text-secondary">Agent Orchestration</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <li key={path}>
                <Link
                  to={path}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600/15 text-primary-400'
                      : 'text-text-secondary hover:bg-surface-light hover:text-text-primary',
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin-only section */}
        {user?.email === ADMIN_EMAIL && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
              Admin
            </p>
            <Link
              to="/admin/feedback"
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                location.pathname === '/admin/feedback'
                  ? 'bg-purple-600/15 text-purple-400'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary',
              )}
            >
              <Shield size={18} />
              Feedback Console
            </Link>
          </div>
        )}
      </nav>

      {/* User & Settings */}
      <div className="border-t border-border px-3 py-3">
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-light hover:text-text-primary"
        >
          <Settings size={18} />
          Settings
        </Link>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-light hover:text-red-400"
        >
          <LogOut size={18} />
          Logout
        </button>
        {user && (
          <div className="mt-2 px-3 py-2">
            <p className="text-sm font-medium text-text-primary">{user.name}</p>
            <p className="text-xs text-text-secondary">{user.email}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
