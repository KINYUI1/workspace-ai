import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '@/components/common/Toast';
import { CommandPalette } from '@/components/common/CommandPalette';
import { FeedbackWidget } from '@/components/common/FeedbackWidget';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <FeedbackWidget />
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}
