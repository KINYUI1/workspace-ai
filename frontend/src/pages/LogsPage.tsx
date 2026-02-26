import { useRef, useEffect } from 'react';
import { ScrollText, Download, Trash2, Search, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { useLogStore, type LogEntry } from '@/stores/log.store';

const LEVEL_COLORS: Record<string, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const LEVEL_BG: Record<string, string> = {
  debug: 'bg-gray-500/10',
  info: 'bg-blue-500/10',
  warn: 'bg-amber-500/10',
  error: 'bg-red-500/10',
};

const SOURCE_COLORS: Record<string, string> = {
  agent: 'text-primary-400',
  system: 'text-text-secondary',
  task: 'text-green-400',
  tool: 'text-amber-400',
};

export function LogsPage() {
  const { entries, filter, setFilter, clearLogs, exportAsJSON, exportAsCSV, getFilteredEntries } = useLogStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const filteredEntries = getFilteredEntries();

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const handleExport = (format: 'json' | 'csv') => {
    const content = format === 'json' ? exportAsJSON() : exportAsCSV();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-ai-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-text-secondary" />
          <h1 className="text-xl font-bold text-text-primary">Event Log</h1>
          <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs text-text-secondary">
            {filteredEntries.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-light"
          >
            <Download size={12} />
            JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-light"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search logs..."
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
          />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-text-secondary" />
          {['all', 'debug', 'info', 'warn', 'error'].map((level) => (
            <button
              key={level}
              onClick={() => setFilter({ level: level === 'all' ? null : level })}
              className={clsx(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                (filter.level === level || (level === 'all' && !filter.level))
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-1 border-l border-border pl-3">
          {['all', 'agent', 'system', 'task', 'tool'].map((source) => (
            <button
              key={source}
              onClick={() => setFilter({ source: source === 'all' ? null : source })}
              className={clsx(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                (filter.source === source || (source === 'all' && !filter.source))
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background font-mono text-xs">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <ScrollText size={40} className="mb-3 opacity-20" />
            <p className="text-sm">No log entries yet</p>
            <p className="text-xs opacity-60 mt-1">Events will appear here as agents work</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredEntries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={clsx('flex items-start gap-3 px-4 py-2 hover:bg-surface/50', LEVEL_BG[entry.level])}>
      {/* Timestamp */}
      <span className="shrink-0 text-text-secondary w-20">{time}</span>

      {/* Level badge */}
      <span className={clsx('shrink-0 w-12 uppercase font-semibold', LEVEL_COLORS[entry.level])}>
        {entry.level}
      </span>

      {/* Source */}
      <span className={clsx('shrink-0 w-14', SOURCE_COLORS[entry.source])}>
        [{entry.source}]
      </span>

      {/* Agent name */}
      {entry.agentName && (
        <span className="shrink-0 text-primary-400 w-20 truncate">
          {entry.agentName}
        </span>
      )}

      {/* Message */}
      <span className="flex-1 text-text-primary break-words">
        {entry.message}
      </span>
    </div>
  );
}
