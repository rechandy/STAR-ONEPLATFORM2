import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchLicenses } from '@/lib/api/services';
import { SolerStation } from '@/components/SolerStation';

export const dynamic = 'force-dynamic';

/** SOLER pillar — offline-first data collection. Gated by the SOLER license. */
export default async function SolerPage() {
  const session = getSession();
  if (!session) redirect('/login');

  const licenses = await fetchLicenses(session);
  const licensed = (licenses?.products ?? []).find((p) => p.product === 'SOLER')?.licensed ?? false;

  return (
    <main className="shell">
      <header className="hero hero-left">
        <Link href="/dashboard" className="muted">
          ← Dashboard
        </Link>
        <h1>SOLER</h1>
        <p className="muted">Student Outcomes, Lessons, Evaluations &amp; Reports — offline-first data collection.</p>
      </header>

      {licensed ? (
        <SolerStation staffId={session.staffId} tenantId={session.tenantId} />
      ) : (
        <section className="outbox">
          <p className="muted">SOLER is not licensed for your district.</p>
        </section>
      )}
    </main>
  );
}
