import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useSessionStore, type ChatSession } from '@/stores/session.store';

export function SessionSidebar() {
  const { sessions, activeSessionId, isLoading, fetchSessions, createSession, switchSession, renameSession, deleteSession } = useSessionStore();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNewChat = async () => {
    await createSession();
  };

  // Group sessions by date
  const groups = groupByDate(sessions);

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-surface">
      {/* New Chat button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-light transition-colors"
        >
          <Plus size={14} />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {isLoading && sessions.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-text-secondary">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-text-secondary">
            No conversations yet
          </p>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label} className="mb-3">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {label}
              </p>
              {items.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => switchSession(session.id)}
                  onRename={(name) => renameSession(session.id, name)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);

  const handleRename = () => {
    if (editName.trim() && editName !== session.name) {
      onRename(editName.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className={clsx(
        'group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors',
        isActive ? 'bg-primary-600/15 text-primary-400' : 'text-text-secondary hover:bg-surface-light hover:text-text-primary',
      )}
      onClick={() => !editing && onSelect()}
    >
      <MessageSquare size={13} className="shrink-0" />

      {editing ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-text-primary focus:outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={(e) => { e.stopPropagation(); handleRename(); }} className="text-green-400 hover:text-green-300">
            <Check size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="text-text-secondary hover:text-text-primary">
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 truncate text-xs">{session.name}</span>
          <div className="hidden items-center gap-0.5 group-hover:flex">
            <button
              onClick={(e) => { e.stopPropagation(); setEditName(session.name); setEditing(true); }}
              className="rounded p-0.5 text-text-secondary hover:text-text-primary"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-0.5 text-text-secondary hover:text-red-400"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function groupByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const groups: Record<string, ChatSession[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    let label: string;

    if (date >= today) {
      label = 'Today';
    } else if (date >= yesterday) {
      label = 'Yesterday';
    } else if (date >= weekAgo) {
      label = 'This Week';
    } else {
      label = 'Older';
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(session);
  }

  return groups;
}
