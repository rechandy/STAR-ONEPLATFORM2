import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchStudentPredictions } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

/** Student record — per-IEP-goal predicted attainment, color-coded by risk band. */
export default async function StudentRecordPage({ params }: { params: { studentId: string } }) {
  const session = getSession();
  if (!session) redirect('/login');

  const data = await fetchStudentPredictions(session, params.studentId);
  if (!data) {
    return (
      <main className="shell">
        <header className="hero hero-left">
          <Link href="/students" className="muted">← My Students</Link>
          <h1>Student not found</h1>
          <p className="muted">No record for {params.studentId}, or the prediction service is unavailable.</p>
        </header>
      </main>
    );
  }

  const c = data.summary.counts;
  return (
    <main className="shell">
      <header className="hero hero-left">
        <Link href="/students" className="muted">← My Students</Link>
        <h1>{data.name}</h1>
        <p className="muted">
          {data.grade}
          {data.age != null ? ` · age ${data.age}` : ''} · {data.diagnosis}
        </p>
      </header>

      <section className="outbox" aria-label="IEP goal outlook">
        <h2>IEP goal outlook</h2>
        <p className="muted">
          Predicted likelihood of meeting each goal by annual review —{' '}
          <b style={{ color: '#b00020' }}>{c.red} at risk</b> · <b style={{ color: '#9a6400' }}>{c.yellow} monitor</b> ·{' '}
          <b style={{ color: '#1a7f37' }}>{c.green} on track</b>.
        </p>
        <ul className="goal-pred-list">
          {data.goals.map((g) => (
            <li key={g.goalId}>
              <span className={`risk risk-${g.band}`}>{g.label}</span>
              <div className="goal-pred-main">
                <span className="goal-pred-domain">{g.domain}</span>
                <span className="goal-pred-desc">{g.description}</span>
              </div>
              <div className="goal-pred-meta">
                <span className="goal-pred-prob">{Math.round(g.probability * 100)}%</span>
                <span className="muted">likely to meet</span>
                {g.currentAccuracy != null && (
                  <span className="muted goal-pred-acc">now {Math.round(g.currentAccuracy * 100)}% acc.</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="muted goal-pred-foot">
          Predictions from a logistic-regression model over progress-monitoring signals (accuracy, trend, prompt level,
          consecutive progress). Bands: ≥75% On Track · 50–74% Monitor · &lt;50% At Risk.
        </p>
      </section>
    </main>
  );
}
