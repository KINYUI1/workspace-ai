import { useState, useMemo } from 'react';
import { clsx } from 'clsx';

interface CronBuilderProps {
  value: string;
  onChange: (expression: string) => void;
}

const PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every Monday', value: '0 9 * * 1' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'First of every month', value: '0 0 1 * *' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeCron(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) return 'Invalid expression';

  const [min, hour, dom, mon, dow] = parts;

  if (expression === '* * * * *') return 'Every minute';
  if (expression === '0 * * * *') return 'Every hour';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*') return 'Every day at midnight';
  if (min === '0' && dom === '*' && mon === '*' && dow === '*') return `Every day at ${hour}:00`;
  if (min === '0' && dom === '*' && mon === '*' && dow === '1-5') return `Every weekday at ${hour}:00`;
  if (min === '0' && dom === '1' && mon === '*' && dow === '*') return `First of every month at ${hour}:00`;

  return `${min} ${hour} ${dom} ${mon} ${dow}`;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const parts = useMemo(() => value.split(' '), [value]);

  const description = useMemo(() => describeCron(value), [value]);

  const updatePart = (index: number, newValue: string) => {
    const newParts = [...parts];
    while (newParts.length < 5) newParts.push('*');
    newParts[index] = newValue;
    onChange(newParts.join(' '));
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode('preset')}
          className={clsx(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'preset' ? 'bg-primary-600/15 text-primary-400' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          Presets
        </button>
        <button
          onClick={() => setMode('custom')}
          className={clsx(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'custom' ? 'bg-primary-600/15 text-primary-400' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          Custom
        </button>
      </div>

      {mode === 'preset' ? (
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              className={clsx(
                'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                value === preset.value
                  ? 'border-primary-500 bg-primary-600/10 text-primary-400'
                  : 'border-border text-text-secondary hover:bg-surface-light',
              )}
            >
              <p className="font-medium">{preset.label}</p>
              <p className="mt-0.5 font-mono text-[10px] opacity-60">{preset.value}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Custom fields */}
          <div className="grid grid-cols-5 gap-2">
            {['Minute', 'Hour', 'Day', 'Month', 'Weekday'].map((label, i) => (
              <div key={label}>
                <label className="block text-[10px] font-medium text-text-secondary mb-1">{label}</label>
                <input
                  value={parts[i] || '*'}
                  onChange={(e) => updatePart(i, e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono text-text-primary focus:border-primary-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {/* Quick selectors */}
          <div className="flex flex-wrap gap-1">
            {DAYS_OF_WEEK.map((day, i) => (
              <button
                key={day}
                onClick={() => updatePart(4, String(i))}
                className={clsx(
                  'rounded-md px-2 py-1 text-[10px] font-medium',
                  parts[4] === String(i) ? 'bg-primary-600/15 text-primary-400' : 'text-text-secondary hover:bg-surface-light',
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expression display */}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Expression:</span>
          <code className="rounded bg-surface-light px-2 py-0.5 text-xs font-mono text-primary-400">{value}</code>
        </div>
        <p className="mt-1 text-xs text-text-secondary">{description}</p>
      </div>
    </div>
  );
}
