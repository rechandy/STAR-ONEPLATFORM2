import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SOLER_URL = process.env.SOLER_URL ?? 'http://localhost:3003';
const FALLBACK_TENANT = process.env.SYNC_TENANT ?? 'star-demo';

/**
 * BFF for the SOLER pull/delta sync. The iPad GETs the roster/curriculum/
 * assignment delta it caches offline; this handler forwards the cursor query to
 * SOLER, injecting tenant + staff identity SERVER-SIDE from the session.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getSession();
  const tenantId = session?.tenantId ?? FALLBACK_TENANT;
  const staffId = session?.staffId ?? req.headers.get('x-user-id') ?? process.env.SYNC_DEMO_STAFF ?? 'T0026';
  const qs = req.nextUrl.search; // ?collections=...&cursor=...&limit=...

  let res: Response;
  try {
    res = await fetch(`${SOLER_URL}/api/sync/changes${qs}`, {
      headers: { 'x-tenant-id': tenantId, 'x-user-id': staffId },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'soler service unavailable' }, { status: 502 });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
