'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO = [
  { id: 'A0001', label: 'Carter Davis — Admin (Meadowbrook Academy)' },
  { id: 'A0003', label: 'Oliver Lopez — Admin (Lakewood Academy)' },
  { id: 'T0026', label: 'Oliver Williams — Teacher (Meadowbrook)' },
];

export default function LoginPage() {
  const router = useRouter();
  const [staffId, setStaffId] = useState('A0001');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(id: string) {
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ staffId: id }),
    });
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Sign-in failed');
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <span className="brand-star" aria-hidden>
          ★
        </span>
        <h1>Sign in to OnePlatform</h1>
        <p className="muted">Demo sign-in — choose an account or enter a staff ID.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void signIn(staffId.trim());
          }}
        >
          <label htmlFor="staffId">Staff ID</label>
          <input
            id="staffId"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            autoComplete="username"
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-demo">
          <p className="muted">Quick demo accounts</p>
          {DEMO.map((d) => (
            <button key={d.id} type="button" className="link" onClick={() => void signIn(d.id)} disabled={busy}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
