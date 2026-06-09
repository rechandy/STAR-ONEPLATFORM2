import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, encodeSession } from '@/lib/auth/session';
import { ROSTER_GRAPH_URL } from '@/lib/api/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TENANT = process.env.SYNC_TENANT ?? 'star-demo';

/** Demo login: verifies the user exists (via /me), then sets a session cookie. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { staffId } = (await req.json().catch(() => ({}))) as { staffId?: string };
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  let me: unknown;
  try {
    const res = await fetch(`${ROSTER_GRAPH_URL}/api/me`, {
      headers: { 'x-tenant-id': TENANT, 'x-user-id': staffId },
    });
    if (!res.ok) return NextResponse.json({ error: 'unknown user' }, { status: 401 });
    me = await res.json();
  } catch {
    return NextResponse.json({ error: 'auth service unavailable' }, { status: 502 });
  }

  const out = NextResponse.json({ ok: true, user: me });
  out.cookies.set(SESSION_COOKIE, encodeSession({ staffId, tenantId: TENANT }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return out;
}
