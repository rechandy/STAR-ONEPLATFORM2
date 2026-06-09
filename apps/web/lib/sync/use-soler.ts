'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IndexedDbStore,
  enqueue,
  flush,
  pull,
  PullError,
  type FlushSummary,
  type OutboxRecord,
  type PullSummary,
  type ReferenceRow,
} from './index';

const store = typeof window !== 'undefined' ? new IndexedDbStore() : null;
const PUSH = process.env.NEXT_PUBLIC_SOLER_SYNC_URL ?? '/api/soler/sync/mutations';
const PULL = process.env.NEXT_PUBLIC_SOLER_CHANGES_URL ?? '/api/soler/sync/changes';
const COLLECTIONS = ['roster', 'curriculum', 'goals', 'assignments'];

export interface RosterStudent {
  studentId: string;
  givenName: string;
  familyName: string;
  grade?: string;
  age?: number;
  primaryDiagnosis?: string;
}
export interface Goal {
  goalId: string;
  studentId: string;
  classId: string | null;
  domain: string;
  description: string;
  objectiveId: string | null;
  status: string;
  goalMet: boolean;
}
export interface Assignment {
  id: string;
  objectiveId: string;
  studentId: string | null;
  classId: string | null;
  status: string;
  lastAccuracy: number | null;
  objective?: { code: string; domain: string; title: string };
}

export interface RunSessionInput {
  studentId: string;
  goalId: string;
  classId?: string | null;
  domain: string;
  trials: number;
  correct: number;
  masteryTarget?: number;
  promptLevel?: number;
}

const rowsOf = <T,>(refs: ReferenceRow[]): T[] => refs.map((r) => r.row as T);

/**
 * Offline-first SOLER data-collection station. Pulls the roster/curriculum/
 * goals/assignments slice into IndexedDB (works offline thereafter), captures
 * sessions into the on-device outbox (durable immediately), and flushes to
 * SOLER when online. Auto-syncs on the browser `online` event.
 */
export function useSoler(staffId = 'T0026', tenantId = 'star-demo') {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [outbox, setOutbox] = useState<OutboxRecord[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!store) return;
    const [r, g, a, ob] = await Promise.all([
      store.referenceByCollection('roster'),
      store.referenceByCollection('goals'),
      store.referenceByCollection('assignments'),
      store.all(),
    ]);
    setRoster(rowsOf<RosterStudent>(r).sort((x, y) => x.familyName.localeCompare(y.familyName)));
    setGoals(rowsOf<Goal>(g));
    setAssignments(rowsOf<Assignment>(a));
    setOutbox(ob);
  }, []);

  const syncPull = useCallback(async (): Promise<PullSummary | null> => {
    if (!store) return null;
    try {
      const s = await pull({ store, fetchImpl: fetch.bind(globalThis), endpoint: PULL, tenantId, staffId, collections: COLLECTIONS, limit: 500 });
      await refresh();
      return s;
    } catch (e) {
      if (e instanceof PullError) return null; // offline/5xx -> keep cached data
      throw e;
    }
  }, [refresh, staffId, tenantId]);

  const syncPush = useCallback(async (): Promise<FlushSummary | null> => {
    if (!store) return null;
    const s = await flush({ store, fetchImpl: fetch.bind(globalThis), endpoint: PUSH, tenantId, staffId });
    await refresh();
    return s;
  }, [refresh, staffId, tenantId]);

  /** Capture a whole data-collection session offline (create + trials + finalize). */
  const runSession = useCallback(
    async (input: RunSessionInput) => {
      if (!store) return;
      const sessionId = globalThis.crypto.randomUUID();
      // Strictly increasing clock so enqueuedAt preserves create < trials <
      // finalize order in the flush batch (FIFO), regardless of IndexedDB key order.
      let t = Date.now();
      const clock = () => t++;
      const promptLevel = input.promptLevel ?? 0;

      await enqueue(
        store,
        {
          collection: 'session',
          op: 'create',
          payload: {
            sessionId,
            studentId: input.studentId,
            domain: input.domain,
            goalId: input.goalId,
            classId: input.classId ?? null,
            masteryTarget: input.masteryTarget ?? 0.8,
            promptLevel,
          },
        },
        clock,
      );
      for (let i = 0; i < input.trials; i++) {
        await enqueue(
          store,
          { collection: 'trial', op: 'create', payload: { sessionId, ordinal: i + 1, correct: i < input.correct, promptLevel } },
          clock,
        );
      }
      await enqueue(store, { collection: 'session', op: 'finalize', payload: { sessionId } }, clock);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    void (async () => {
      await refresh();
      await syncPull();
    })();
    const onOnline = async () => {
      setOnline(true);
      await syncPush();
      await syncPull();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh, syncPull, syncPush]);

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const push = await syncPush();
      const pulled = await syncPull();
      return { push, pulled };
    } finally {
      setBusy(false);
    }
  }, [syncPush, syncPull]);

  const pending = outbox.filter((r) => r.status === 'pending').length;
  const parked = outbox.filter((r) => r.status === 'needs_attention').length;

  return { roster, goals, assignments, outbox, pending, parked, online, busy, runSession, sync, syncPull, refresh };
}
