import Link from 'next/link';
import { OutboxDemo } from '@/components/OutboxDemo';

const PILLARS = [
  { name: 'Links Curriculum', desc: 'Leveled, research-based curriculum teachers use to instruct.' },
  { name: 'SOLER', desc: 'Student Outcomes, Lessons, Evaluations & Reports — progress monitoring.' },
  { name: 'SOLS', desc: 'STAR Online Learning System — educator training & certification.' },
  { name: 'Media Center', desc: 'Searchable repository of instructional & reference videos.' },
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero">
        <span className="brand-star" aria-hidden>
          ★
        </span>
        <h1>STAR OnePlatform</h1>
        <p>One platform connecting all four STAR pillars on a unified data engine.</p>
        <div className="hero-cta">
          <Link href="/login" className="btn">
            Sign in
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Open dashboard
          </Link>
        </div>
      </header>

      <section className="pillars" aria-label="Platform pillars">
        {PILLARS.map((p) => (
          <article key={p.name} className="pillar-card">
            <h2>{p.name}</h2>
            <p>{p.desc}</p>
          </article>
        ))}
      </section>

      <OutboxDemo />

      <footer className="foot">
        <p>Phase 0 shell · installable PWA · mobile &amp; iPad-first</p>
      </footer>
    </main>
  );
}
