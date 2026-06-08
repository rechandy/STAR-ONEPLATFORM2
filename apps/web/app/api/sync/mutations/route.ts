import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SERVICE = process.env.STUDENT_RECORD_URL ?? 'http://localhost:3002';
const TENANT = process.env.SYNC_TENANT ?? 'star-demo';

/**
 * BFF for the offline outbox. The browser posts here (same origin); this
 * handler forwards to the student-record service, injecting the tenant and the
 * acting staff identity SERVER-SIDE.
 *
 * SECURITY: in production tenant + staff come from the verified session/IAM
 * claim — never trusted from the client. The `x-user-id` fallback below is a
 * dev stand-in only.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const staffId = req.headers.get('x-user-id') ?? process.env.SYNC_DEMO_STAFF ?? 'T0026';

  let res: Response;
  try {
    res = await fetch(`${SERVICE}/api/sync/mutations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT, 'x-user-id': staffId },
      body,
    });
  } catch {
    return NextResponse.json({ error: 'sync service unavailable' }, { status: 502 });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
