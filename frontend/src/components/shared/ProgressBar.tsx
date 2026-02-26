import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ value, size = 'sm', showLabel = true, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'flex-1 overflow-hidden rounded-full bg-surface-light',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-[width] duration-300 ease-out',
            clamped >= 100 ? 'bg-green-500' : clamped >= 50 ? 'bg-primary-500' : 'bg-blue-500',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-text-secondary tabular-nums">{clamped}%</span>}
    </div>
  );
}
