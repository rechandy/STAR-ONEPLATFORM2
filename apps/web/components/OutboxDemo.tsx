'use client';

import { useState } from 'react';
import { useOutbox } from '@/lib/sync/use-outbox';

/** Minimal demo of the offline-first outbox wired to /sync/mutations. */
export function OutboxDemo() {
  const { records, record, sync } = useOutbox();
  const [msg, setMsg] = useState('');
  const pending = records.filter((r) => r.status === 'pending').length;
  const parked = records.filter((r) => r.status === 'needs_attention').length;

  return (
    <section className="outbox" aria-label="Offline data collection demo">
      <h2>Offline data collection</h2>
      <p>Outcomes are saved to an on-device outbox immediately, then synced when online.</p>
      <div className="outbox-actions">
        <button
          type="button"
          onClick={async () => {
            await record({
              studentId: 'S00001',
              metricType: 'TRIAL_SCORE',
              value: { trials: 10, correct: 9, promptLevel: 2 },
              goalId: 'G00001',
              classId: 'class-T0026-comm',
            });
            setMsg('Queued a trial locally (works offline).');
          }}
        >
          Record trial
        </button>
        <button
          type="button"
          onClick={async () => {
            const s = await sync();
            setMsg(
              s
                ? `Synced: ${s.applied} applied, ${s.duplicate} duplicate, ${s.rejected} rejected, ${s.retry} retry`
                : 'Queued locally (no sync endpoint configured).',
            );
          }}
        >
          Sync now
        </button>
      </div>
      <p className="outbox-status">
        Outbox: {records.length} record(s) · {pending} pending · {parked} need attention. {msg}
      </p>
    </section>
  );
}
