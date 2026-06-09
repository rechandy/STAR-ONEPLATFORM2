import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './store';
import { CHANGES_CURSOR, pull, PullError, type PullDeps } from './pull';
import type { ChangesResponse } from './types';

const deps = (store: MemoryStore, fetchImpl: typeof fetch): PullDeps => ({
  store,
  fetchImpl,
  endpoint: '/api/soler/sync/changes',
  tenantId: 'star-demo',
  staffId: 'T0026',
  limit: 100,
});

/** A fake server returning a scripted sequence of pages (one per request). */
const pager = (pages: ChangesResponse[]): typeof fetch => {
  let i = 0;
  return (async () => {
    const body = pages[Math.min(i, pages.length - 1)];
    i++;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
};

const errStatus = (code: number): typeof fetch =>
  (async () => new Response('err', { status: code })) as unknown as typeof fetch;

describe('pull — applying changes', () => {
  it('writes upserts into the reference cache', async () => {
    const store = new MemoryStore();
    const s = await pull(
      deps(
        store,
        pager([
          {
            serverTime: 't',
            changes: {
              roster: [{ id: 'S00001', op: 'upsert', version: 1, row: { givenName: 'Ethan' } }],
              curriculum: [{ id: 'obj-1', op: 'upsert', version: 1, row: { title: 'X' } }],
            },
            nextCursor: 'c1',
            hasMore: false,
          },
        ]),
      ),
    );
    assert.equal(s.upserts, 2);
    assert.equal(s.pages, 1);
    const roster = await store.referenceByCollection('roster');
    assert.equal(roster.length, 1);
    assert.equal(roster[0].id, 'S00001');
    assert.equal((roster[0].row as { givenName: string }).givenName, 'Ethan');
  });

  it('applies tombstones (delete prunes the cache)', async () => {
    const store = new MemoryStore();
    await store.putReference([
      { key: 'assignments:a1', collection: 'assignments', id: 'a1', version: 1, row: { status: 'ASSIGNED' } },
    ]);
    const s = await pull(
      deps(
        store,
        pager([
          { serverTime: 't', changes: { assignments: [{ id: 'a1', op: 'delete', version: 2 }] }, nextCursor: 'c1', hasMore: false },
        ]),
      ),
    );
    assert.equal(s.deletes, 1);
    assert.equal((await store.referenceByCollection('assignments')).length, 0);
  });

  it('persists and resumes from the committed cursor', async () => {
    const store = new MemoryStore();
    await pull(
      deps(store, pager([{ serverTime: 't', changes: {}, nextCursor: 'cursor-XYZ', hasMore: false }])),
    );
    assert.equal(await store.getCursor(CHANGES_CURSOR), 'cursor-XYZ');
  });
});

describe('pull — pagination', () => {
  it('drains all pages while hasMore is true', async () => {
    const store = new MemoryStore();
    const s = await pull(
      deps(
        store,
        pager([
          { serverTime: 't', changes: { assignments: [{ id: 'a1', op: 'upsert', version: 1, row: {} }] }, nextCursor: 'c1', hasMore: true },
          { serverTime: 't', changes: { assignments: [{ id: 'a2', op: 'upsert', version: 1, row: {} }] }, nextCursor: 'c2', hasMore: true },
          { serverTime: 't', changes: { assignments: [{ id: 'a3', op: 'upsert', version: 1, row: {} }] }, nextCursor: 'c3', hasMore: false },
        ]),
      ),
    );
    assert.equal(s.pages, 3);
    assert.equal(s.upserts, 3);
    assert.equal(await store.getCursor(CHANGES_CURSOR), 'c3');
    assert.equal((await store.referenceByCollection('assignments')).length, 3);
  });

  it('stops at maxPages even if the server keeps saying hasMore', async () => {
    const store = new MemoryStore();
    const s = await pull({
      ...deps(store, pager([{ serverTime: 't', changes: {}, nextCursor: 'c', hasMore: true }])),
      maxPages: 5,
    });
    assert.equal(s.pages, 5);
  });
});

describe('pull — error classification', () => {
  it('throws retryable PullError on 503', async () => {
    const store = new MemoryStore();
    await assert.rejects(
      () => pull(deps(store, errStatus(503))),
      (e: unknown) => e instanceof PullError && e.retryable,
    );
  });

  it('throws fatal PullError on 400', async () => {
    const store = new MemoryStore();
    await assert.rejects(
      () => pull(deps(store, errStatus(400))),
      (e: unknown) => e instanceof PullError && !e.retryable,
    );
  });
});
