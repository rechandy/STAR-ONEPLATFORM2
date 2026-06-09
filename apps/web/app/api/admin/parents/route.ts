import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { forwardAdmin } from '@/lib/api/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  const { status, text } = await forwardAdmin(session, 'parents', await req.text());
  return new NextResponse(text, { status, headers: { 'content-type': 'application/json' } });
}
