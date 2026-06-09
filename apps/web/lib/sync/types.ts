// On-device sync types — see docs/architecture/05-offline-sync-protocol.md.

export interface OutcomePayload {
  studentId: string;
  metricType: string;
  value: unknown;
  source?: string;
  goalId?: string;
  classId?: string;
  occurredAt?: string;
  [k: string]: unknown;
}

/** Canonical payload for a mutation — shape depends on collection/op. */
export type SyncPayload = Record<string, unknown>;

export interface MutationInput {
  /** metricEvent (Student Record) | session | trial (SOLER). */
  collection: string;
  /** create | finalize. */
  op: string;
  payload: SyncPayload;
}

export type OutboxStatus = 'pending' | 'synced' | 'needs_attention';

export interface OutboxRecord {
  opId: string;
  collection: string;
  op: string;
  schemaVersion: number;
  payload: SyncPayload;
  occurredAt: string;
  enqueuedAt: string;
  attempts: number;
  /** epoch ms; while in backoff the record is not eligible until this time. */
  nextAttemptAt: number | null;
  status: OutboxStatus;
  lastError?: string;
}

export interface MutationResult {
  opId: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  serverId?: string;
  error?: { code: string; message: string };
}

export interface SyncResponse {
  serverTime: string;
  results: MutationResult[];
}

export interface FlushSummary {
  attempted: number;
  applied: number;
  duplicate: number;
  rejected: number;
  /** left in the outbox for a future attempt (offline / 5xx / 429 / auth). */
  retry: number;
}

// ---- Pull / delta sync (protocol §4) --------------------------------------

export interface ChangeRow {
  id: string;
  op: 'upsert' | 'delete';
  version: number;
  /** present on upsert; absent on delete (tombstone). */
  row?: Record<string, unknown>;
}

export interface ChangesResponse {
  serverTime: string;
  changes: Record<string, ChangeRow[]>;
  /** opaque compound cursor (all collections) — store and echo, never parse. */
  nextCursor: string;
  hasMore: boolean;
}

/** A cached server read-model row in the on-device `reference` store. */
export interface ReferenceRow {
  /** `${collection}:${id}` — the IndexedDB key. */
  key: string;
  collection: string;
  id: string;
  version: number;
  row: Record<string, unknown>;
}

export interface PullSummary {
  pages: number;
  upserts: number;
  deletes: number;
  byCollection: Record<string, number>;
}
