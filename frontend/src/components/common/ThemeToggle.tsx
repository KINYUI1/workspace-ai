import { Sun, Moon, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsStore, type ThemeMode } from '@/stores/settings.store';

const MODES: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore();

  return (
    <div className="flex items-center rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Theme">
      {MODES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={clsx(
            'rounded-md p-1.5 transition-colors',
            theme === value
              ? 'bg-primary-600/15 text-primary-400'
              : 'text-text-secondary hover:text-text-primary',
          )}
          title={label}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
