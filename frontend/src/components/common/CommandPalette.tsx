import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Bot,
  Users,
  ListTodo,
  FileText,
  Settings,
  Plus,
  ScrollText,
  Radio,
  Blocks,
  Brain,
  Clock,
  MessageSquarePlus,
} from 'lucide-react';
import { clsx } from 'clsx';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, action: () => navigate('/'), category: 'Navigation' },
    { id: 'nav-chat', label: 'Go to Chat', icon: MessageSquare, action: () => navigate('/chat'), category: 'Navigation' },
    { id: 'nav-agents', label: 'Go to Agents', icon: Bot, action: () => navigate('/agents'), category: 'Navigation' },
    { id: 'nav-teams', label: 'Go to Teams', icon: Users, action: () => navigate('/teams'), category: 'Navigation' },
    { id: 'nav-tasks', label: 'Go to Tasks', icon: ListTodo, action: () => navigate('/tasks'), category: 'Navigation' },
    { id: 'nav-files', label: 'Go to Files', icon: FileText, action: () => navigate('/files'), category: 'Navigation' },
    { id: 'nav-logs', label: 'Go to Logs', icon: ScrollText, action: () => navigate('/logs'), category: 'Navigation' },
    { id: 'nav-channels', label: 'Go to Channels', icon: Radio, action: () => navigate('/channels'), category: 'Navigation' },
    { id: 'nav-extensions', label: 'Go to Extensions', icon: Blocks, action: () => navigate('/extensions'), category: 'Navigation' },
    { id: 'nav-memory', label: 'Go to Memory', icon: Brain, action: () => navigate('/memory'), category: 'Navigation' },
    { id: 'nav-cron', label: 'Go to Cron Jobs', icon: Clock, action: () => navigate('/cron'), category: 'Navigation' },
    { id: 'nav-feedback', label: 'Go to Feedback', icon: MessageSquarePlus, action: () => navigate('/feedback'), category: 'Navigation' },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, action: () => navigate('/settings'), category: 'Navigation' },
    // Quick actions
    { id: 'action-new-chat', label: 'New Chat', description: 'Start a new conversation', icon: Plus, action: () => navigate('/chat'), category: 'Actions' },
    { id: 'action-new-task', label: 'Create Task', description: 'Create a new task', icon: Plus, action: () => navigate('/tasks'), category: 'Actions' },
  ], [navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item: CommandItem) => {
    item.action();
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
          <kbd className="rounded border border-border bg-surface-light px-1.5 py-0.5 text-[10px] text-text-secondary">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">No results found</p>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {category}
                </p>
                {items.map((item) => {
                  globalIndex++;
                  const idx = globalIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        idx === selectedIndex
                          ? 'bg-primary-600/15 text-primary-400'
                          : 'text-text-primary hover:bg-surface-light',
                      )}
                    >
                      <Icon size={16} className="shrink-0 text-text-secondary" />
                      <span className="flex-1">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-text-secondary">{item.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 text-[10px] text-text-secondary flex items-center gap-4">
          <span><kbd className="rounded border border-border bg-surface-light px-1 py-0.5 mr-1">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border bg-surface-light px-1 py-0.5 mr-1">↵</kbd> select</span>
          <span><kbd className="rounded border border-border bg-surface-light px-1 py-0.5 mr-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
