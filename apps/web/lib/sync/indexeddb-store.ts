import type { SyncStore } from './store';
import type { OutboxRecord, ReferenceRow } from './types';

const DB_NAME = 'oneplatform-sync';
const DB_VERSION = 2;
const OUTBOX = 'outbox';
const REFERENCE = 'reference';
const CURSORS = 'cursors';

interface CursorRow {
  key: string;
  token: string;
}

/** IndexedDB-backed outbox + pull caches for the browser. */
export class IndexedDbStore implements SyncStore {
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(OUTBOX)) {
            db.createObjectStore(OUTBOX, { keyPath: 'opId' });
          }
          if (!db.objectStoreNames.contains(REFERENCE)) {
            const ref = db.createObjectStore(REFERENCE, { keyPath: 'key' });
            ref.createIndex('byCollection', 'collection', { unique: false });
          }
          if (!db.objectStoreNames.contains(CURSORS)) {
            db.createObjectStore(CURSORS, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async tx<T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const req = fn(transaction.objectStore(storeName));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Run several writes against one store in a single transaction. */
  private async batch(storeName: string, fn: (store: IDBObjectStore) => void): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      fn(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async add(rec: OutboxRecord): Promise<void> {
    await this.tx(OUTBOX, 'readwrite', (s) => s.put(rec));
  }

  async update(opId: string, patch: Partial<OutboxRecord>): Promise<void> {
    const cur = await this.tx<OutboxRecord | undefined>(OUTBOX, 'readonly', (s) => s.get(opId));
    if (cur) await this.tx(OUTBOX, 'readwrite', (s) => s.put({ ...cur, ...patch }));
  }

  async remove(opId: string): Promise<void> {
    await this.tx(OUTBOX, 'readwrite', (s) => s.delete(opId));
  }

  async all(): Promise<OutboxRecord[]> {
    return this.tx<OutboxRecord[]>(OUTBOX, 'readonly', (s) => s.getAll());
  }

  async eligible(now: number, limit: number): Promise<OutboxRecord[]> {
    const all = await this.all();
    return all
      .filter((r) => r.status === 'pending' && (r.nextAttemptAt === null || r.nextAttemptAt <= now))
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt))
      .slice(0, limit);
  }

  async putReference(rows: ReferenceRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.batch(REFERENCE, (s) => {
      for (const r of rows) s.put(r);
    });
  }

  async deleteReference(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.batch(REFERENCE, (s) => {
      for (const k of keys) s.delete(k);
    });
  }

  async referenceByCollection(collection: string): Promise<ReferenceRow[]> {
    const db = await this.open();
    return new Promise<ReferenceRow[]>((resolve, reject) => {
      const idx = db.transaction(REFERENCE, 'readonly').objectStore(REFERENCE).index('byCollection');
      const req = idx.getAll(IDBKeyRange.only(collection));
      req.onsuccess = () => resolve(req.result as ReferenceRow[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getCursor(key: string): Promise<string | null> {
    const row = await this.tx<CursorRow | undefined>(CURSORS, 'readonly', (s) => s.get(key));
    return row?.token ?? null;
  }

  async setCursor(key: string, token: string): Promise<void> {
    await this.tx(CURSORS, 'readwrite', (s) => s.put({ key, token } satisfies CursorRow));
  }
}
