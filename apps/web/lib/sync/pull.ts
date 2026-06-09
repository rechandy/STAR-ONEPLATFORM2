import { type BackoffConfig, classifyStatus } from './backoff';
import type { SyncStore } from './store';
import type { ChangesResponse, PullSummary, ReferenceRow } from './types';

/** One opaque compound cursor (covers all collections) lives under this key. */
export const CHANGES_CURSOR = 'changes';

export interface PullDeps {
  store: SyncStore;
  fetchImpl: typeof fetch;
  endpoint: string; // e.g. '/api/soler/sync/changes'
  tenantId: string;
  staffId: string;
  collections?: string[];
  limit?: number;
  /** safety bound on the page loop (default 100). */
  maxPages?: number;
  backoff?: BackoffConfig;
}

export class PullError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'PullError';
  }
}

const EMPTY: PullSummary = { pages: 0, upserts: 0, deletes: 0, byCollection: {} };

/**
 * Pull side of the sync engine (protocol §4): drains the server delta into the
 * on-device `reference` cache, applying upserts and tombstones and advancing
 * the opaque cursor after each page. Resumable — a crashed pull restarts from
 * the last committed cursor. Network/5xx/429/401 surface as a retryable
 * PullError (the caller backs off); 4xx is fatal.
 */
export async function pull(deps: PullDeps): Promise<PullSummary> {
  const maxPages = deps.maxPages ?? 100;
  const summary: PullSummary = { ...EMPTY, byCollection: {} };

  let cursor = await deps.store.getCursor(CHANGES_CURSOR);

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(deps.endpoint, 'http://local');
    if (deps.collections?.length) url.searchParams.set('collections', deps.collections.join(','));
    if (deps.limit) url.searchParams.set('limit', String(deps.limit));
    if (cursor) url.searchParams.set('cursor', cursor);
    // Preserve a relative endpoint (the URL base above is only for parsing).
    const target = deps.endpoint.startsWith('http') ? url.toString() : url.pathname + url.search;

    let res: Response;
    try {
      res = await deps.fetchImpl(target, {
        method: 'GET',
        headers: { 'x-tenant-id': deps.tenantId, 'x-user-id': deps.staffId },
      });
    } catch (e) {
      throw new PullError(`network error: ${String(e)}`, true);
    }

    if (!res.ok) {
      const cls = classifyStatus(res.status);
      throw new PullError(`HTTP ${res.status}`, cls !== 'fatal');
    }

    const data = (await res.json()) as ChangesResponse;
    const upserts: ReferenceRow[] = [];
    const deletes: string[] = [];

    for (const [collection, rows] of Object.entries(data.changes ?? {})) {
      for (const change of rows) {
        const key = `${collection}:${change.id}`;
        if (change.op === 'delete') {
          deletes.push(key);
          summary.deletes++;
        } else if (change.row) {
          upserts.push({ key, collection, id: change.id, version: change.version, row: change.row });
          summary.upserts++;
        }
        summary.byCollection[collection] = (summary.byCollection[collection] ?? 0) + 1;
      }
    }

    // Apply the page, THEN commit the cursor — so a crash never advances past
    // unapplied changes (at-least-once; upserts/deletes are idempotent).
    await deps.store.putReference(upserts);
    await deps.store.deleteReference(deletes);
    await deps.store.setCursor(CHANGES_CURSOR, data.nextCursor);
    cursor = data.nextCursor;
    summary.pages++;

    if (!data.hasMore) break;
  }

  return summary;
}
