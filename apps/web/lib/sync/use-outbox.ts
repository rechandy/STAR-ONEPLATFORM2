'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IndexedDbStore,
  enqueue,
  flush,
  type FlushSummary,
  type OutboxRecord,
  type OutcomePayload,
} from './index';

const store = typeof window !== 'undefined' ? new IndexedDbStore() : null;
// Same-origin BFF route (app/api/sync/mutations) — forwards to student-record.
const ENDPOINT = process.env.NEXT_PUBLIC_SYNC_URL ?? '/api/sync/mutations';
const TENANT = process.env.NEXT_PUBLIC_TENANT ?? 'star-demo';

/**
 * React hook over the offline outbox: enqueue outcomes locally (durable
 * immediately) and flush to /sync/mutations when online. Auto-flushes on the
 * browser `online` event.
 */
export function useOutbox(staffId = 'T0026') {
  const [records, setRecords] = useState<OutboxRecord[]>([]);

  const refresh = useCallback(async () => {
    if (store) setRecords(await store.all());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const record = useCallback(
    async (payload: OutcomePayload) => {
      if (!store) return;
      await enqueue(store, { collection: 'metricEvent', op: 'create', payload });
      await refresh();
    },
    [refresh],
  );

  const sync = useCallback(async (): Promise<FlushSummary | null> => {
    if (!store || !ENDPOINT) {
      await refresh();
      return null;
    }
    const summary = await flush({
      store,
      fetchImpl: fetch.bind(globalThis),
      endpoint: ENDPOINT,
      tenantId: TENANT,
      staffId,
    });
    await refresh();
    return summary;
  }, [refresh, staffId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sync]);

  return { records, record, sync, refresh };
}
