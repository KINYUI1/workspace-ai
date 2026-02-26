import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'workspace-ai-cache';
const DB_VERSION = 1;
const ENTITY_STORE = 'entities';

interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ENTITY_STORE)) {
          db.createObjectStore(ENTITY_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getCached<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  try {
    const db = await getDB();
    const entry = await db.get(ENTITY_STORE, key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    return { data: entry.data, timestamp: entry.timestamp };
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDB();
    const entry: CacheEntry<T> = { key, data, timestamp: Date.now() };
    await db.put(ENTITY_STORE, entry);
  } catch {
    // Silently fail — cache is best-effort
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(ENTITY_STORE, key);
  } catch {
    // Silent
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(ENTITY_STORE);
  } catch {
    // Silent
  }
}

export function isFresh(timestamp: number, maxAgeMs: number): boolean {
  return Date.now() - timestamp < maxAgeMs;
}
