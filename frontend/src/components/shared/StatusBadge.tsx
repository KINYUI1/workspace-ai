import { clsx } from 'clsx';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: 'bg-status-active', label: 'Active' },
  idle: { color: 'bg-status-idle', label: 'Idle' },
  busy: { color: 'bg-status-busy', label: 'Busy' },
  error: { color: 'bg-status-error', label: 'Error' },
  offline: { color: 'bg-status-offline', label: 'Offline' },
  // Task statuses
  pending: { color: 'bg-yellow-500', label: 'Pending' },
  in_progress: { color: 'bg-blue-500', label: 'In Progress' },
  blocked: { color: 'bg-red-500', label: 'Blocked' },
  completed: { color: 'bg-green-500', label: 'Completed' },
  failed: { color: 'bg-red-600', label: 'Failed' },
  // Team statuses
  paused: { color: 'bg-yellow-600', label: 'Paused' },
  archived: { color: 'bg-gray-600', label: 'Archived' },
};

interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, showDot = true, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { color: 'bg-gray-500', label: status };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
    >
      {showDot && (
        <span
          className={clsx('rounded-full', config.color, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')}
        />
      )}
      {config.label}
    </span>
  );
}
