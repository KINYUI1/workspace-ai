import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (type, message, duration = 4000) => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, type, message, duration }] });
  },
  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast('success', msg),
  error: (msg: string) => useToastStore.getState().addToast('error', msg),
  warning: (msg: string) => useToastStore.getState().addToast('warning', msg),
  info: (msg: string) => useToastStore.getState().addToast('info', msg),
};

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

function ToastItem({ toast: t, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[t.type];

  const handleRemove = useCallback(() => {
    setExiting(true);
    setTimeout(onRemove, 200);
  }, [onRemove]);

  useEffect(() => {
    if (t.duration && t.duration > 0) {
      const timer = setTimeout(handleRemove, t.duration);
      return () => clearTimeout(timer);
    }
  }, [t.duration, handleRemove]);

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-200',
        COLORS[t.type],
        exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100',
      )}
    >
      <Icon size={16} className="shrink-0" />
      <p className="flex-1 text-sm">{t.message}</p>
      <button onClick={handleRemove} className="shrink-0 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
