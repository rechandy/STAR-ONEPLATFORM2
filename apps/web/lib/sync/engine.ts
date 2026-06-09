import { type BackoffConfig, DEFAULT_BACKOFF, classifyStatus, computeBackoff } from './backoff';
import type { SyncStore } from './store';
import type { FlushSummary, MutationInput, OutboxRecord, SyncResponse } from './types';

const SCHEMA_VERSION = 1;

export interface FlushDeps {
  store: SyncStore;
  fetchImpl: typeof fetch;
  endpoint: string; // e.g. '/api/sync/mutations'
  tenantId: string;
  staffId: string;
  deviceId?: string;
  now?: () => number;
  rand?: () => number;
  backoff?: BackoffConfig;
  batchSize?: number;
}

/** Enqueue a mutation into the outbox (durable immediately; never blocks on network). */
export async function enqueue(
  store: SyncStore,
  input: MutationInput,
  now: () => number = Date.now,
): Promise<OutboxRecord> {
  const t = now();
  const occAt = input.payload.occurredAt;
  const occurredAt = typeof occAt === 'string' ? occAt : new Date(t).toISOString();
  const rec: OutboxRecord = {
    opId: globalThis.crypto.randomUUID(),
    collection: input.collection,
    op: input.op,
    schemaVersion: SCHEMA_VERSION,
    payload: { ...input.payload, occurredAt },
    occurredAt,
    enqueuedAt: new Date(t).toISOString(),
    attempts: 0,
    nextAttemptAt: null,
    status: 'pending',
  };
  await store.add(rec);
  return rec;
}

const EMPTY: FlushSummary = { attempted: 0, applied: 0, duplicate: 0, rejected: 0, retry: 0 };

/** Flush one batch of eligible outbox records to /sync/mutations. */
export async function flush(deps: FlushDeps): Promise<FlushSummary> {
  const now = deps.now ?? Date.now;
  const rand = deps.rand ?? Math.random;
  const cfg = deps.backoff ?? DEFAULT_BACKOFF;
  const batch = await deps.store.eligible(now(), deps.batchSize ?? 100);
  if (batch.length === 0) return { ...EMPTY };

  const body = JSON.stringify({
    deviceId: deps.deviceId ?? 'web',
    clientTime: new Date(now()).toISOString(),
    mutations: batch.map((r) => ({
      opId: r.opId,
      collection: r.collection,
      op: r.op,
      schemaVersion: r.schemaVersion,
      payload: r.payload,
      occurredAt: r.occurredAt,
    })),
  });

  let res: Response;
  try {
    res = await deps.fetchImpl(deps.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': deps.tenantId, 'x-user-id': deps.staffId },
      body,
    });
  } catch {
    // offline / network error -> keep pending, back off
    await backoffAll(deps.store, batch, cfg, rand, now(), 'network error');
    return { ...EMPTY, attempted: batch.length, retry: batch.length };
  }

  if (!res.ok) {
    if (classifyStatus(res.status) === 'fatal') {
      // batch-level 4xx (e.g. malformed body) -> park for attention
      for (const r of batch) {
        await deps.store.update(r.opId, { status: 'needs_attention', lastError: `HTTP ${res.status}` });
      }
      return { ...EMPTY, attempted: batch.length, rejected: batch.length };
    }
    // auth (401) or retryable (429/5xx) -> never drop the queue; back off
    await backoffAll(deps.store, batch, cfg, rand, now(), `HTTP ${res.status}`);
    return { ...EMPTY, attempted: batch.length, retry: batch.length };
  }

  const data = (await res.json()) as SyncResponse;
  const byId = new Map(data.results.map((r) => [r.opId, r]));
  const summary: FlushSummary = { ...EMPTY, attempted: batch.length };

  for (const rec of batch) {
    const r = byId.get(rec.opId);
    if (!r) {
      await scheduleBackoff(deps.store, rec, cfg, rand, now(), 'no result');
      summary.retry++;
    } else if (r.status === 'applied') {
      await deps.store.remove(rec.opId);
      summary.applied++;
    } else if (r.status === 'duplicate') {
      await deps.store.remove(rec.opId);
      summary.duplicate++;
    } else {
      // conflict | rejected -> needs attention (do not silently drop)
      await deps.store.update(rec.opId, {
        status: 'needs_attention',
        lastError: r.error?.message ?? r.status,
      });
      summary.rejected++;
    }
  }
  return summary;
}

async function scheduleBackoff(
  store: SyncStore,
  rec: OutboxRecord,
  cfg: BackoffConfig,
  rand: () => number,
  now: number,
  err: string,
): Promise<void> {
  const attempts = rec.attempts + 1;
  if (attempts >= cfg.maxAttempts) {
    await store.update(rec.opId, { attempts, status: 'needs_attention', lastError: err });
    return;
  }
  await store.update(rec.opId, {
    attempts,
    nextAttemptAt: now + computeBackoff(attempts, cfg, rand),
    lastError: err,
  });
}

async function backoffAll(
  store: SyncStore,
  batch: OutboxRecord[],
  cfg: BackoffConfig,
  rand: () => number,
  now: number,
  err: string,
): Promise<void> {
  for (const r of batch) await scheduleBackoff(store, r, cfg, rand, now, err);
}
