import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { OctagonX, Bell, Search, Bot, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '@/components/shared/Modal';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useUsageStore } from '@/stores/usage.store';
import { useLogStore } from '@/stores/log.store';

const LEVEL_ICONS = {
  debug: Info,
  info: CheckCircle,
  warn: AlertTriangle,
  error: XCircle,
};

const LEVEL_COLORS = {
  debug: 'text-text-secondary',
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function Header() {
  const navigate = useNavigate();
  const [showEmergencyStop, setShowEmergencyStop] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const { sessionInputTokens, sessionOutputTokens, callCount, getEstimatedCost } = useUsageStore();
  const entries = useLogStore((s) => s.entries);

  // Only show info/warn/error in notifications (not debug)
  const notifications = entries.filter((e) => e.level !== 'debug').slice(0, 50);
  const unreadCount = Math.max(0, notifications.length - lastSeenCount);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showNotifications]);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
        {/* Left: usage stats */}
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          {callCount > 0 && (
            <>
              <span>{(sessionInputTokens + sessionOutputTokens).toLocaleString()} tokens</span>
              <span>${getEstimatedCost().toFixed(4)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Command palette trigger */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-light"
          >
            <Search size={12} />
            <span>Search...</span>
            <kbd className="rounded border border-border bg-surface-light px-1 py-0.5 text-[10px]">⌘K</kbd>
          </button>

          <ThemeToggle />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) {
                  setLastSeenCount(notifications.length);
                }
              }}
              className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-light hover:text-text-primary"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-border bg-surface shadow-2xl z-50">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                  <span className="text-xs text-text-secondary">{notifications.length} events</span>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-text-secondary">
                      No notifications yet. Activity from agents, tasks, and system events will appear here.
                    </div>
                  ) : (
                    notifications.map((entry) => {
                      const Icon = LEVEL_ICONS[entry.level];
                      return (
                        <div
                          key={entry.id}
                          className="flex gap-3 border-b border-border/50 px-4 py-3 hover:bg-surface-light/50 transition-colors"
                        >
                          <div className={clsx('mt-0.5 shrink-0', LEVEL_COLORS[entry.level])}>
                            {entry.source === 'agent' ? <Bot size={14} /> : <Icon size={14} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text-primary truncate">{entry.message}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
                              {entry.agentName && <span className="font-medium text-primary-400">{entry.agentName}</span>}
                              <span>{entry.source}</span>
                              <span>{timeAgo(entry.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="border-t border-border px-4 py-2">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/logs');
                      }}
                      className="w-full rounded-lg py-1.5 text-center text-xs font-medium text-primary-400 hover:bg-surface-light"
                    >
                      View all in Logs
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowEmergencyStop(true)}
            className="flex items-center gap-2 rounded-lg bg-red-600/15 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/25"
          >
            <OctagonX size={16} />
            Emergency Stop
          </button>
        </div>
      </header>

      <Modal
        open={showEmergencyStop}
        onClose={() => setShowEmergencyStop(false)}
        title="Emergency Stop"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            This will immediately pause all active agents and stop all running tasks. You can resume
            later, but progress on current tasks may be lost.
          </p>
          <p className="text-sm font-medium text-red-400">Are you sure you want to stop all agents?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowEmergencyStop(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // TODO: Call emergency stop API
                setShowEmergencyStop(false);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Stop All Agents
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
