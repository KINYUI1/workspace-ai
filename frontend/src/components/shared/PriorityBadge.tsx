import { clsx } from 'clsx';

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: 'text-gray-400 bg-gray-400/10', label: 'Low' },
  medium: { color: 'text-blue-400 bg-blue-400/10', label: 'Medium' },
  high: { color: 'text-orange-400 bg-orange-400/10', label: 'High' },
  critical: { color: 'text-red-400 bg-red-400/10', label: 'Critical' },
};

interface PriorityBadgeProps {
  priority: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

  return (
    <span className={clsx('inline-flex rounded px-1.5 py-0.5 text-xs font-medium', config.color)}>
      {config.label}
    </span>
  );
}
