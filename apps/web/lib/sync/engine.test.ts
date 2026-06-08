import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store';
import { enqueue, flush, type FlushDeps } from './engine';
import { computeBackoff, DEFAULT_BACKOFF } from './backoff';
import type { MutationInput, MutationResult } from './types';

const sample: MutationInput = {
  collection: 'metricEvent',
  op: 'create',
  payload: { studentId: 'S00001', metricType: 'TRIAL_SCORE', value: { trials: 10, correct: 9 } },
};

const baseDeps = (store: MemoryStore, fetchImpl: typeof fetch): FlushDeps => ({
  store,
  fetchImpl,
  endpoint: '/api/sync/mutations',
  tenantId: 'star-demo',
  staffId: 'T0026',
  now: () => 1000,
  rand: () => 0.5,
});

// Fake server that echoes each mutation's opId with a chosen status.
const echo = (statusFor: (op: string) => MutationResult['status']): typeof fetch =>
  (async (_url: string, init: { body: string }) => {
    const { mutations } = JSON.parse(init.body) as { mutations: { opId: string }[] };
    const results: MutationResult[] = mutations.map((m) => ({
      opId: m.opId,
      status: statusFor(m.opId),
      ...(statusFor(m.opId) === 'rejected' ? { error: { code: 'forbidden', message: 'no' } } : {}),
    }));
    return new Response(JSON.stringify({ serverTime: 't', results }), { status: 200 });
  }) as unknown as typeof fetch;

const status = (code: number): typeof fetch =>
  (async () => new Response('err', { status: code })) as unknown as typeof fetch;

const offline: typeof fetch = (async () => {
  throw new Error('offline');
}) as unknown as typeof fetch;

describe('enqueue', () => {
  it('persists a pending record durably', async () => {
    const store = new MemoryStore();
    const rec = await enqueue(store, sample, () => 1000);
    assert.equal(rec.status, 'pending');
    const all = await store.all();
    assert.equal(all.length, 1);
    assert.equal(all[0].opId, rec.opId);
  });
});

describe('flush — server acknowledgements', () => {
  it('removes applied records', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    const s = await flush(baseDeps(store, echo(() => 'applied')));
    assert.equal(s.applied, 1);
    assert.equal((await store.all()).length, 0);
  });

  it('removes duplicates (idempotent retry)', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    const s = await flush(baseDeps(store, echo(() => 'duplicate')));
    assert.equal(s.duplicate, 1);
    assert.equal((await store.all()).length, 0);
  });

  it('parks rejected records as needs_attention', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    const s = await flush(baseDeps(store, echo(() => 'rejected')));
    assert.equal(s.rejected, 1);
    const all = await store.all();
    assert.equal(all[0].status, 'needs_attention');
  });
});

describe('flush — failures keep the queue', () => {
  it('keeps pending and backs off on offline', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    const s = await flush(baseDeps(store, offline));
    assert.equal(s.retry, 1);
    const [rec] = await store.all();
    assert.equal(rec.status, 'pending');
    assert.equal(rec.attempts, 1);
    assert.ok(rec.nextAttemptAt && rec.nextAttemptAt > 1000);
  });

  it('keeps pending and backs off on 503', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    const s = await flush(baseDeps(store, status(503)));
    assert.equal(s.retry, 1);
    assert.equal((await store.all())[0].status, 'pending');
  });

  it('does not drop the queue on 401 (auth)', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    await flush(baseDeps(store, status(401)));
    assert.equal((await store.all())[0].status, 'pending');
  });

  it('parks the batch on a fatal 400', async () => {
    const store = new MemoryStore();
    await enqueue(store, sample, () => 1000);
    const s = await flush(baseDeps(store, status(400)));
    assert.equal(s.rejected, 1);
    assert.equal((await store.all())[0].status, 'needs_attention');
  });
});

describe('eligibility & backoff', () => {
  it('skips records still in backoff', async () => {
    const store = new MemoryStore();
    const rec = await enqueue(store, sample, () => 1000);
    await store.update(rec.opId, { nextAttemptAt: 999999 });
    const s = await flush(baseDeps(store, echo(() => 'applied')));
    assert.equal(s.attempted, 0);
  });

  it('full-jitter backoff stays within the ceiling', () => {
    const d = computeBackoff(3, DEFAULT_BACKOFF, () => 0.999);
    assert.ok(d <= DEFAULT_BACKOFF.baseMs * 2 ** 3);
  });
});
