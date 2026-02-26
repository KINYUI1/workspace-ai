import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  Sparkles,
  MessageCircle,
  Star,
  Trash2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/services/api';
import { toast } from '@/components/common/Toast';

interface FeedbackEntry {
  id: string;
  type: string;
  rating: number | null;
  message: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bug; label: string; color: string; badge: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/30' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  improvement: { icon: Sparkles, label: 'Improvement', color: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  general: { icon: MessageCircle, label: 'General', color: 'text-green-400', badge: 'bg-green-500/10 text-green-400 border-green-500/30' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  reviewed: { label: 'Reviewed', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
};

const STATUS_CYCLE = ['new', 'reviewed', 'resolved'];

export function FeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedbackRes, statsRes] = await Promise.all([
        api.getFeedback(),
        api.getFeedbackStats(),
      ]);
      setEntries((feedbackRes as any).data || []);
      setStats((statsRes as any).data || null);
    } catch {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (id: string, currentStatus: string) => {
    const currentIdx = STATUS_CYCLE.indexOf(currentStatus);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    try {
      await api.updateFeedback(id, { status: nextStatus });
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: nextStatus } : e)));
      toast.success(`Status updated to ${nextStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteFeedback(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Feedback deleted');
    } catch {
      toast.error('Failed to delete feedback');
    }
  };

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/15">
            <MessageSquarePlus size={20} className="text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Feedback</h1>
            <p className="text-sm text-text-secondary">User feedback and suggestions</p>
          </div>
          {stats && (
            <span className="ml-2 rounded-full bg-primary-600/15 px-2.5 py-0.5 text-xs font-medium text-primary-400">
              {stats.total}
            </span>
          )}
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-light"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
            <p className="text-xs text-text-secondary">Total</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-bold text-red-400">{stats.byType.bug || 0}</p>
            <p className="text-xs text-text-secondary">Bugs</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-bold text-blue-400">{stats.byType.feature || 0}</p>
            <p className="text-xs text-text-secondary">Features</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-bold text-blue-400">{stats.byStatus.new || 0}</p>
            <p className="text-xs text-text-secondary">New</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-bold text-green-400">{stats.byStatus.resolved || 0}</p>
            <p className="text-xs text-text-secondary">Resolved</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-text-secondary" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="improvement">Improvement</option>
          <option value="general">General</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="text-xs text-text-secondary">{filtered.length} entries</span>
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <MessageSquarePlus size={32} className="mx-auto mb-3 text-text-secondary/40" />
          <p className="text-sm text-text-secondary">
            {entries.length === 0
              ? 'No feedback yet. Use the feedback widget to submit your first entry.'
              : 'No feedback matches the current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const typeConf = TYPE_CONFIG[entry.type] || TYPE_CONFIG.general;
            const statusConf = STATUS_CONFIG[entry.status] || STATUS_CONFIG.new;
            const TypeIcon = typeConf.icon;

            return (
              <div
                key={entry.id}
                className="flex items-start gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-light/50"
              >
                {/* Type icon */}
                <div className={clsx('mt-0.5 shrink-0', typeConf.color)}>
                  <TypeIcon size={18} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx('rounded-md border px-2 py-0.5 text-[10px] font-medium', typeConf.badge)}>
                      {typeConf.label}
                    </span>
                    <button
                      onClick={() => handleStatusChange(entry.id, entry.status)}
                      className={clsx('rounded-md border px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80', statusConf.color)}
                      title="Click to cycle status"
                    >
                      {statusConf.label}
                    </button>
                    {entry.rating && (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <Star
                            key={v}
                            size={10}
                            className={clsx(v <= entry.rating! ? 'fill-amber-400 text-amber-400' : 'text-text-secondary/30')}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-text-primary">{entry.message}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {new Date(entry.createdAt).toLocaleDateString()} at{' '}
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="shrink-0 rounded p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
