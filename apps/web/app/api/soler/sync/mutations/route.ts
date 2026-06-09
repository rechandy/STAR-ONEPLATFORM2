import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SOLER_URL = process.env.SOLER_URL ?? 'http://localhost:3003';
const FALLBACK_TENANT = process.env.SYNC_TENANT ?? 'star-demo';

/**
 * BFF for the SOLER offline outbox. The iPad posts session/trial/finalize
 * mutations here (same origin); this handler forwards to the SOLER service,
 * injecting tenant + acting staff identity SERVER-SIDE from the session (never
 * trusted from the client). The dev fallbacks are stand-ins only.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getSession();
  const tenantId = session?.tenantId ?? FALLBACK_TENANT;
  const staffId = session?.staffId ?? req.headers.get('x-user-id') ?? process.env.SYNC_DEMO_STAFF ?? 'T0026';
  const body = await req.text();

  let res: Response;
  try {
    res = await fetch(`${SOLER_URL}/api/sync/mutations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId, 'x-user-id': staffId },
      body,
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
