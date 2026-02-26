import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'workspace-ai-offline';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  body?: string;
  headers: Record<string, string>;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueMutation(
  method: string,
  url: string,
  body?: string,
  headers: Record<string, string> = {},
): Promise<void> {
  try {
    const db = await getDB();
    const mutation: QueuedMutation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      method,
      url,
      body,
      headers,
      timestamp: Date.now(),
    };
    await db.add(STORE_NAME, mutation);
  } catch {
    // Silent fail
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(STORE_NAME);
  } catch {
    return 0;
  }
}

export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  let replayed = 0;
  let failed = 0;

  try {
    const db = await getDB();
    const mutations = await db.getAll(STORE_NAME) as QueuedMutation[];

    // Replay in order (oldest first)
    mutations.sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of mutations) {
      try {
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: mutation.headers,
          body: mutation.body,
        });

        if (response.ok || response.status === 204) {
          await db.delete(STORE_NAME, mutation.id);
          replayed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
        // Stop replaying on network error (still offline)
        break;
      }
    }
  } catch {
    // DB error
  }

  return { replayed, failed };
}

export async function clearQueue(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch {
    // Silent
  }
}
