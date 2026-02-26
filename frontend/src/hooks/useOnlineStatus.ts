import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, replayQueue } from '@/services/offline-queue';

interface OnlineStatus {
  isOnline: boolean;
  pendingMutations: number;
  replayPending: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingMutations, setPendingMutations] = useState(0);

  // Check pending count periodically and on status change
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingMutations(count);
  }, []);

  const replayPending = useCallback(async () => {
    if (!navigator.onLine) return;
    const { replayed } = await replayQueue();
    if (replayed > 0) {
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-replay queued mutations when coming back online
      replayPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshPendingCount();

    // Periodic check for pending mutations
    const interval = setInterval(refreshPendingCount, 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [replayPending, refreshPendingCount]);

  return { isOnline, pendingMutations, replayPending };
}
