// ---------------------------------------------------------------------------
// In-Process Job Scheduler — replaces BullMQ + Redis for desktop mode.
// Uses node-cron for recurring jobs and setTimeout for one-time delays.
// ---------------------------------------------------------------------------

interface ScheduledJob {
  id: string;
  type: 'once' | 'cron';
  handler: () => Promise<void>;
  cancel: () => void;
}

const activeJobs = new Map<string, ScheduledJob>();

/**
 * Schedule a one-time delayed job.
 */
export function scheduleOnce(
  jobId: string,
  handler: () => Promise<void>,
  delayMs: number,
): void {
  // Cancel existing job with same ID
  cancelJob(jobId);

  const timer = setTimeout(async () => {
    try {
      await handler();
    } catch (err) {
      console.error(`[local-scheduler] One-time job ${jobId} failed:`, err);
    } finally {
      activeJobs.delete(jobId);
    }
  }, Math.max(0, delayMs));

  activeJobs.set(jobId, {
    id: jobId,
    type: 'once',
    handler,
    cancel: () => clearTimeout(timer),
  });
}

/**
 * Schedule a recurring cron job.
 */
export function scheduleCron(
  jobId: string,
  cronExpression: string,
  handler: () => Promise<void>,
): void {
  // Cancel existing job with same ID
  cancelJob(jobId);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cron = require('node-cron');

    if (!cron.validate(cronExpression)) {
      console.warn(`[local-scheduler] Invalid cron expression for job ${jobId}: ${cronExpression}`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        await handler();
      } catch (err) {
        console.error(`[local-scheduler] Cron job ${jobId} failed:`, err);
      }
    });

    activeJobs.set(jobId, {
      id: jobId,
      type: 'cron',
      handler,
      cancel: () => task.stop(),
    });
  } catch (err) {
    console.warn(`[local-scheduler] Could not schedule cron job ${jobId}:`, err);
  }
}

/**
 * Cancel and remove a scheduled job.
 */
export function cancelJob(jobId: string): void {
  const job = activeJobs.get(jobId);
  if (job) {
    job.cancel();
    activeJobs.delete(jobId);
  }
}

/**
 * Cancel all active jobs (called on shutdown).
 */
export function cancelAllJobs(): void {
  for (const job of activeJobs.values()) {
    job.cancel();
  }
  activeJobs.clear();
}

/**
 * Get count of active scheduled jobs.
 */
export function getActiveJobCount(): number {
  return activeJobs.size;
}
