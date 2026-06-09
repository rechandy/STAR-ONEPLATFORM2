import type { OutboxRecord, ReferenceRow } from './types';

/** Storage abstraction for the outbox + pull caches (IndexedDB in the browser, memory in tests). */
export interface SyncStore {
  // ---- push: outbox ----
  add(rec: OutboxRecord): Promise<void>;
  /** Records eligible to send now: status pending and nextAttemptAt <= now, FIFO. */
  eligible(now: number, limit: number): Promise<OutboxRecord[]>;
  update(opId: string, patch: Partial<OutboxRecord>): Promise<void>;
  remove(opId: string): Promise<void>;
  all(): Promise<OutboxRecord[]>;

  // ---- pull: reference cache + cursors ----
  putReference(rows: ReferenceRow[]): Promise<void>;
  deleteReference(keys: string[]): Promise<void>;
  referenceByCollection(collection: string): Promise<ReferenceRow[]>;
  getCursor(key: string): Promise<string | null>;
  setCursor(key: string, token: string): Promise<void>;
}

/** In-memory store — used by tests and as a reference implementation. */
export class MemoryStore implements SyncStore {
  private readonly map = new Map<string, OutboxRecord>();
  private readonly reference = new Map<string, ReferenceRow>();
  private readonly cursors = new Map<string, string>();

  async add(rec: OutboxRecord): Promise<void> {
    this.map.set(rec.opId, { ...rec });
  }

  async eligible(now: number, limit: number): Promise<OutboxRecord[]> {
    return [...this.map.values()]
      .filter((r) => r.status === 'pending' && (r.nextAttemptAt === null || r.nextAttemptAt <= now))
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  async update(opId: string, patch: Partial<OutboxRecord>): Promise<void> {
    const cur = this.map.get(opId);
    if (cur) this.map.set(opId, { ...cur, ...patch });
  }

  async remove(opId: string): Promise<void> {
    this.map.delete(opId);
  }

  async all(): Promise<OutboxRecord[]> {
    return [...this.map.values()].map((r) => ({ ...r }));
  }

  async putReference(rows: ReferenceRow[]): Promise<void> {
    for (const r of rows) this.reference.set(r.key, { ...r });
  }

  async deleteReference(keys: string[]): Promise<void> {
    for (const k of keys) this.reference.delete(k);
  }

  async referenceByCollection(collection: string): Promise<ReferenceRow[]> {
    return [...this.reference.values()]
      .filter((r) => r.collection === collection)
      .map((r) => ({ ...r }));
  }

  async getCursor(key: string): Promise<string | null> {
    return this.cursors.get(key) ?? null;
  }

  async setCursor(key: string, token: string): Promise<void> {
    this.cursors.set(key, token);
  }
}
