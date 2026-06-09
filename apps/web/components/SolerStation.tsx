'use client';

import { useMemo, useState } from 'react';
import { useSoler } from '@/lib/sync/use-soler';

/**
 * SOLER offline data-collection station. Roster/goals/assignments are pulled
 * into IndexedDB and usable offline; a recorded session lands in the on-device
 * outbox immediately and flushes to SOLER on "Sync now" (or when connectivity
 * returns). Watch a goal's assignment advance to MASTERED after sync.
 */
export function SolerStation({ staffId, tenantId }: { staffId: string; tenantId: string }) {
  const { roster, goals, assignments, pending, parked, online, busy, runSession, sync } = useSoler(staffId, tenantId);
  const [studentId, setStudentId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [trials, setTrials] = useState(10);
  const [correct, setCorrect] = useState(9);
  const [msg, setMsg] = useState('');

  const studentGoals = useMemo(() => goals.filter((g) => g.studentId === studentId), [goals, studentId]);
  const studentAssignments = useMemo(
    () => assignments.filter((a) => a.studentId === studentId),
    [assignments, studentId],
  );
  const selectedGoal = studentGoals.find((g) => g.goalId === goalId);

  return (
    <section className="outbox" aria-label="SOLER offline data collection">
      <div className="soler-head">
        <h2>SOLER · Data collection</h2>
        <span className={`pill ${online ? 'pill-on' : 'pill-off'}`}>{online ? 'Online' : 'Offline'}</span>
      </div>
      <p className="muted">
        Cached offline: {roster.length} students · {goals.length} goals · {assignments.length} assignments.
      </p>

      <div className="soler-form">
        <label>
          Student
          <select
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setGoalId('');
            }}
          >
            <option value="">Select a student…</option>
            {roster.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.familyName}, {s.givenName} {s.grade ? `(${s.grade})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          Goal
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} disabled={!studentId}>
            <option value="">Select a goal…</option>
            {studentGoals.map((g) => (
              <option key={g.goalId} value={g.goalId}>
                [{g.domain.replace(/_/g, ' ')}] {g.description.slice(0, 60)}
              </option>
            ))}
          </select>
        </label>

        <div className="soler-trials">
          <label>
            Trials
            <input type="number" min={1} max={50} value={trials} onChange={(e) => setTrials(Number(e.target.value))} />
          </label>
          <label>
            Correct
            <input type="number" min={0} max={trials} value={correct} onChange={(e) => setCorrect(Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="outbox-actions">
        <button
          type="button"
          disabled={!selectedGoal}
          onClick={async () => {
            if (!selectedGoal) return;
            await runSession({
              studentId,
              goalId: selectedGoal.goalId,
              classId: selectedGoal.classId,
              domain: selectedGoal.domain,
              trials,
              correct: Math.min(correct, trials),
              masteryTarget: 0.8,
            });
            setMsg(`Captured a ${correct}/${trials} session offline (durable locally).`);
          }}
        >
          Record session offline
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const { push, pulled } = await sync();
            const p = push ? `pushed ${push.applied} applied / ${push.duplicate} dup / ${push.retry} retry` : 'nothing to push';
            const d = pulled ? `pulled ${pulled.upserts} change(s)` : 'pull skipped (offline)';
            setMsg(`Sync: ${p}; ${d}.`);
          }}
        >
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      <p className="outbox-status">
        Outbox: {pending} pending · {parked} need attention. {msg}
      </p>

      {studentId && (
        <div className="soler-assignments">
          <h3>Curriculum assignments for this student</h3>
          {studentAssignments.length === 0 ? (
            <p className="muted">No cached assignments.</p>
          ) : (
            <ul>
              {studentAssignments.map((a) => (
                <li key={a.id}>
                  <span className={`status status-${a.status.toLowerCase()}`}>{a.status}</span>{' '}
                  {a.objective?.title ?? a.objectiveId}
                  {a.lastAccuracy != null ? ` · ${Math.round(a.lastAccuracy * 100)}%` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
