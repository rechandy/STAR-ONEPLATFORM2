import type { OutboxRecord } from './types';

/** Storage abstraction for the outbox (IndexedDB in the browser, memory in tests). */
export interface SyncStore {
  add(rec: OutboxRecord): Promise<void>;
  /** Records eligible to send now: status pending and nextAttemptAt <= now, FIFO. */
  eligible(now: number, limit: number): Promise<OutboxRecord[]>;
  update(opId: string, patch: Partial<OutboxRecord>): Promise<void>;
  remove(opId: string): Promise<void>;
  all(): Promise<OutboxRecord[]>;
}

/** In-memory store — used by tests and as a reference implementation. */
export class MemoryStore implements SyncStore {
  private readonly map = new Map<string, OutboxRecord>();

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
}
