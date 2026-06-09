import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchLicenses, fetchScopeSequence, type CurriculumObjectiveSummary } from '@/lib/api/services';

export const dynamic = 'force-dynamic';

function domainLabel(domain: string): string {
  return domain
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Links pillar — the curriculum scope & sequence map. Gated by the LINKS license. */
export default async function LinksPage() {
  const session = getSession();
  if (!session) redirect('/login');

  const [licenses, scope] = await Promise.all([fetchLicenses(session), fetchScopeSequence(session)]);
  const licensed = (licenses?.products ?? []).find((p) => p.product === 'LINKS')?.licensed ?? false;

  // Group objectives by domain, preserving the server's domain/sequence order.
  const byDomain = new Map<string, CurriculumObjectiveSummary[]>();
  for (const o of scope?.objectives ?? []) {
    const arr = byDomain.get(o.domain) ?? [];
    arr.push(o);
    byDomain.set(o.domain, arr);
  }

  return (
    <main className="shell">
      <header className="hero hero-left">
        <Link href="/dashboard" className="muted">
          ← Dashboard
        </Link>
        <h1>Links Curriculum</h1>
        <p className="muted">Leveled, research-based scope &amp; sequence — the map assignments are built from.</p>
      </header>

      {!licensed ? (
        <section className="outbox">
          <p className="muted">Links is not licensed for your district.</p>
        </section>
      ) : byDomain.size === 0 ? (
        <section className="outbox">
          <p className="muted">No curriculum objectives available.</p>
        </section>
      ) : (
        <div className="links-domains">
          {[...byDomain.entries()].map(([domain, objectives]) => (
            <section key={domain} className="outbox" aria-label={domainLabel(domain)}>
              <h2>{domainLabel(domain)}</h2>
              <ul className="objective-list">
                {objectives.map((o) => (
                  <li key={o.id}>
                    <span className="obj-code">{o.code}</span>
                    <span className="obj-title">{o.title}</span>
                    <span className="obj-lessons">
                      {o.lessonCount} {o.lessonCount === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
