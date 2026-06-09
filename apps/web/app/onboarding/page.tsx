import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchMe } from '@/lib/api/services';
import { OnboardingForms } from '@/components/OnboardingForms';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const session = getSession();
  if (!session) redirect('/login');
  const me = await fetchMe(session);
  if (!me) redirect('/login');

  if (!me.isAdmin) {
    return (
      <main className="shell">
        <header className="hero hero-left">
          <h1>Onboarding</h1>
        </header>
        <p className="muted">You need administrator access to onboard users.</p>
      </main>
    );
  }

  const schools = me.orgs
    .filter((o) => o.type === 'SCHOOL')
    .map((o) => ({ id: o.id, name: o.name }));

  return (
    <main className="shell">
      <header className="hero hero-left">
        <h1>Onboarding &amp; roster</h1>
        <p className="muted">Add teachers, students, and parents to your school(s).</p>
      </header>
      <OnboardingForms schools={schools} />
    </main>
  );
}
