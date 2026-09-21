/**
 * The device mirror.
 *
 * Thin promise wrappers over IndexedDB — no library, because this is the whole of
 * what the app needs and a dependency here would outweigh it.
 *
 * localStorage is not an option any more: recipe photos alone blow past its
 * single-digit-megabyte quota, and it cannot hold a Blob at all.
 */

const DB_NAME = 'served';
// 2 added the backlog store
const DB_VERSION = 2;

export const STORE = {
  recipes: 'recipes',
  ingredients: 'ingredients',
  cookLog: 'cook_log',
  backlog: 'backlog',
  outbox: 'outbox',
  blobs: 'blobs',
  meta: 'meta',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // records keyed by their own id — the same ids the cloud uses, so a pulled
      // row overwrites its local copy without any reconciliation step
      for (const name of [STORE.recipes, STORE.ingredients, STORE.cookLog, STORE.backlog, STORE.blobs]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.outbox)) {
        // seq is the send order, and the queue is drained in it
        db.createObjectStore(STORE.outbox, { keyPath: 'seq', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE.meta)) {
        db.createObjectStore(STORE.meta, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // another tab upgrading needs this one to let go
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open the local database'));
    request.onblocked = () => reject(new Error('The local database is blocked by another tab'));
  });

  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, body: (s: IDBObjectStore) => IDBRequest | null): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = body(tx.objectStore(store));
        let result: unknown;
        if (request) request.onsuccess = () => (result = request.result);
        tx.oncomplete = () => resolve(result as T);
        tx.onerror = () => reject(tx.error ?? new Error(`${store} transaction failed`));
        tx.onabort = () => reject(tx.error ?? new Error(`${store} transaction aborted`));
      }),
  );
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, 'readonly', (s) => s.getAll()).then((rows) => rows ?? []);
}

export function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return run<T | undefined>(store, 'readonly', (s) => s.get(key));
}

export function put<T>(store: StoreName, value: T): Promise<void> {
  return run<void>(store, 'readwrite', (s) => s.put(value));
}

/** One transaction for the whole batch — a delta pull can carry hundreds of rows. */
export function bulkPut<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return Promise.resolve();
  return run<void>(store, 'readwrite', (s) => {
    for (const value of values) s.put(value);
    return null;
  });
}

export function del(store: StoreName, key: IDBValidKey): Promise<void> {
  return run<void>(store, 'readwrite', (s) => s.delete(key));
}

export function bulkDel(store: StoreName, keys: IDBValidKey[]): Promise<void> {
  if (!keys.length) return Promise.resolve();
  return run<void>(store, 'readwrite', (s) => {
    for (const key of keys) s.delete(key);
    return null;
  });
}

export function clearStore(store: StoreName): Promise<void> {
  return run<void>(store, 'readwrite', (s) => s.clear());
}

/**
 * Update a record only if it is still there, reading and writing inside one
 * transaction. A plain `put` cannot express that: something held in memory while a
 * request was in flight can be written back after it was deliberately deleted, which
 * silently resurrects it. Returns whether anything was written.
 */
export function putIfPresent<T>(store: StoreName, key: IDBValidKey, update: (current: T) => T): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const objectStore = tx.objectStore(store);
        let wrote = false;

        const read = objectStore.get(key);
        read.onsuccess = () => {
          if (read.result === undefined) return;
          objectStore.put(update(read.result as T));
          wrote = true;
        };

        tx.oncomplete = () => resolve(wrote);
        tx.onerror = () => reject(tx.error ?? new Error(`${store} transaction failed`));
        tx.onabort = () => reject(tx.error ?? new Error(`${store} transaction aborted`));
      }),
  );
}

/** Append to an autoIncrement store and report the key it was given. */
export function append<T>(store: StoreName, value: T): Promise<number> {
  return run<number>(store, 'readwrite', (s) => s.add(value));
}

/* ----------------------------------------------------------------------- meta */

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await get<{ key: string; value: T }>(STORE.meta, key);
  return row ? row.value : fallback;
}

export function setMeta<T>(key: string, value: T): Promise<void> {
  return put(STORE.meta, { key, value });
}

/** Drop every cached record. The outbox survives — unsent work is not cache. */
export async function clearMirror(): Promise<void> {
  await Promise.all([
    clearStore(STORE.recipes),
    clearStore(STORE.ingredients),
    clearStore(STORE.cookLog),
    clearStore(STORE.backlog),
    clearStore(STORE.meta),
  ]);
}
