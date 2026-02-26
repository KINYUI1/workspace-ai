import { Activity, Clock } from 'lucide-react';

interface ActivityItem {
  id: string;
  agent: string;
  action: string;
  type: 'success' | 'info' | 'warning';
  timestamp: string;
}

interface SystemMonitorProps {
  activities?: ActivityItem[];
  lastSync?: Date | null;
  nextSyncMinutes?: number;
}

const TYPE_ICONS: Record<string, string> = {
  success: 'text-green-400',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
};

export function SystemMonitor({ activities = [], lastSync, nextSyncMinutes = 18 }: SystemMonitorProps) {
  const lastSyncStr = lastSync
    ? `${Math.floor((Date.now() - lastSync.getTime()) / 60_000)} min ago`
    : 'Never';

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Activity size={16} className="text-primary-400" />
          System Activity
        </h3>
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Clock size={12} />
          <span>
            Sync: {lastSyncStr} / Next: {nextSyncMinutes}m
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {activities.length === 0 && (
          <p className="py-4 text-center text-xs text-text-secondary">No recent activity</p>
        )}

        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className={`mt-0.5 h-1.5 w-1.5 rounded-full ${TYPE_ICONS[item.type]}`} />
            <div className="flex-1">
              <p className="text-sm text-text-primary">
                <span className="font-medium">{item.agent}</span> {item.action}
              </p>
              <p className="text-xs text-text-secondary">{item.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
