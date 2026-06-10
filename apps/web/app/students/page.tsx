import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchRosterPredictions, type RiskBand } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

const BAND_LABEL: Record<RiskBand, string> = { red: 'At Risk', yellow: 'Monitor', green: 'On Track' };

/** Teacher caseload with predicted IEP goal-attainment risk (highest risk first). */
export default async function StudentsPage() {
  const session = getSession();
  if (!session) redirect('/login');

  const data = await fetchRosterPredictions(session);
  const students = data?.students ?? [];

  return (
    <main className="shell">
      <header className="hero hero-left">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <h1>My Students</h1>
        <p className="muted">
          Predicted likelihood of meeting IEP goals by annual review — {students.length} students, highest risk first.
        </p>
      </header>

      {students.length === 0 ? (
        <section className="outbox">
          <p className="muted">No students on your caseload, or the prediction service is unavailable.</p>
        </section>
      ) : (
        <section className="outbox">
          <ul className="risk-list">
            {students.map((s) => {
              const c = s.summary.counts;
              return (
                <li key={s.studentId}>
                  <Link href={`/students/${s.studentId}`} className="risk-row">
                    <span className={`risk risk-${s.summary.worstBand}`}>{BAND_LABEL[s.summary.worstBand]}</span>
                    <span className="risk-name">{s.name}</span>
                    <span className="muted risk-grade">{s.grade}</span>
                    <span className="risk-counts">
                      <span className="risk-chip risk-red" title="At risk">{c.red}</span>
                      <span className="risk-chip risk-yellow" title="Monitor">{c.yellow}</span>
                      <span className="risk-chip risk-green" title="On track">{c.green}</span>
                    </span>
                    <span className="open">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
