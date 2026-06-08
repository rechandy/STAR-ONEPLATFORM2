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

export interface MutationInput {
  collection: 'metricEvent';
  op: 'create';
  payload: OutcomePayload;
}

export type OutboxStatus = 'pending' | 'synced' | 'needs_attention';

export interface OutboxRecord {
  opId: string;
  collection: string;
  op: string;
  schemaVersion: number;
  payload: OutcomePayload;
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
