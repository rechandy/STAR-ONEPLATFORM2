import type { SyncStore } from './store';
import type { OutboxRecord } from './types';

const DB_NAME = 'oneplatform-sync';
const STORE = 'outbox';

/** IndexedDB-backed outbox for the browser. */
export class IndexedDbStore implements SyncStore {
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'opId' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const req = fn(transaction.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(rec: OutboxRecord): Promise<void> {
    await this.tx('readwrite', (s) => s.put(rec));
  }

  async update(opId: string, patch: Partial<OutboxRecord>): Promise<void> {
    const cur = await this.tx<OutboxRecord | undefined>('readonly', (s) => s.get(opId));
    if (cur) await this.tx('readwrite', (s) => s.put({ ...cur, ...patch }));
  }

  async remove(opId: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(opId));
  }

  async all(): Promise<OutboxRecord[]> {
    return this.tx<OutboxRecord[]>('readonly', (s) => s.getAll());
  }

  async eligible(now: number, limit: number): Promise<OutboxRecord[]> {
    const all = await this.all();
    return all
      .filter((r) => r.status === 'pending' && (r.nextAttemptAt === null || r.nextAttemptAt <= now))
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt))
      .slice(0, limit);
  }
}
