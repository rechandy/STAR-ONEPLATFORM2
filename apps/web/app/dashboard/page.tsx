import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchLicenses, fetchMe } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

const PILLARS = [
  { product: 'LINKS', name: 'Links Curriculum', desc: 'Leveled, research-based curriculum for instruction.' },
  { product: 'SOLER', name: 'SOLER', desc: 'Student Outcomes, Lessons, Evaluations & Reports.' },
  { product: 'SOLS', name: 'STAR Online Learning', desc: 'Educator training & certification.' },
  { product: 'MEDIA_CENTER', name: 'Media Center', desc: 'Instructional & reference video library.' },
];

function roleLabel(role: string): string {
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DashboardPage() {
  const session = getSession();
  if (!session) redirect('/login');

  const [me, licenses] = await Promise.all([fetchMe(session), fetchLicenses(session)]);
  if (!me) redirect('/login');

  const licensed = new Map((licenses?.products ?? []).map((p) => [p.product, p.licensed]));

  return (
    <main className="shell">
      <header className="hero hero-left">
        <h1>Welcome, {me.name}</h1>
        <p className="muted">
          {roleLabel(me.role)}
          {me.orgs[0] ? ` · ${me.orgs[0].name}` : ''}
        </p>
      </header>

      {me.isAdmin && (
        <div className="admin-cta">
          <Link href="/onboarding" className="btn">
            Onboarding &amp; roster →
          </Link>
        </div>
      )}

      <section className="pillars" aria-label="Product pillars">
        {PILLARS.map((p) => {
          const ok = licensed.get(p.product) ?? false;
          return (
            <article key={p.product} className={`pillar-card ${ok ? '' : 'locked'}`}>
              <div className="pillar-head">
                <h2>{p.name}</h2>
                {!ok && <span className="badge">Not licensed</span>}
              </div>
              <p>{p.desc}</p>
              {ok ? (
                <span className="open">Open →</span>
              ) : (
                <span className="muted">Not available for your district</span>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
