import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchMe, fetchAtRiskInsights } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

/** Leadership view — district-wide IEP goal-attainment risk from the predictive model. */
export default async function InsightsPage() {
  const session = getSession();
  if (!session) redirect('/login');
  const me = await fetchMe(session);
  if (!me) redirect('/login');

  if (!me.isAdmin) {
    return (
      <main className="shell">
        <header className="hero hero-left">
          <Link href="/dashboard" className="muted">← Dashboard</Link>
          <h1>Leadership insights</h1>
          <p className="muted">This view is available to administrators.</p>
        </header>
      </main>
    );
  }

  const ins = await fetchAtRiskInsights(session);

  return (
    <main className="shell">
      <header className="hero hero-left">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <h1>Leadership insights</h1>
        <p className="muted">District-wide IEP goal-attainment outlook, predicted by the model across all active goals.</p>
      </header>

      {!ins ? (
        <section className="outbox">
          <p className="muted">Prediction service unavailable.</p>
        </section>
      ) : (
        <>
          <section className="outbox" aria-label="Risk distribution">
            <h2>Goal-attainment outlook</h2>
            <p className="muted">{ins.totalGoals.toLocaleString()} goals across {ins.students.toLocaleString()} students.</p>
            <div className="riskbar" role="img" aria-label="Risk distribution bar">
              <span className="riskbar-seg seg-red" style={{ width: `${ins.pct.red}%` }} />
              <span className="riskbar-seg seg-yellow" style={{ width: `${ins.pct.yellow}%` }} />
              <span className="riskbar-seg seg-green" style={{ width: `${ins.pct.green}%` }} />
            </div>
            <div className="riskbar-legend">
              <span><span className="dot dot-red" /> At risk — {ins.distribution.red.toLocaleString()} ({ins.pct.red}%)</span>
              <span><span className="dot dot-yellow" /> Monitor — {ins.distribution.yellow.toLocaleString()} ({ins.pct.yellow}%)</span>
              <span><span className="dot dot-green" /> On track — {ins.distribution.green.toLocaleString()} ({ins.pct.green}%)</span>
            </div>
          </section>

          <section className="outbox" aria-label="Top at-risk students">
            <h2>Students needing immediate attention</h2>
            <ul className="risk-list">
              {ins.topAtRisk.map((s) => (
                <li key={s.studentId}>
                  <Link href={`/students/${s.studentId}`} className="risk-row">
                    <span className="risk risk-red">{s.red} at risk</span>
                    <span className="risk-name">{s.name}</span>
                    <span className="risk-counts">
                      <span className="risk-chip risk-red">{s.red}</span>
                      <span className="risk-chip risk-yellow">{s.yellow}</span>
                      <span className="risk-chip risk-green">{s.green}</span>
                    </span>
                    <span className="open">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
