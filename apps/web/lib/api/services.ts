import type { Session } from '@/lib/auth/session';

export const ROSTER_GRAPH_URL = process.env.ROSTER_GRAPH_URL ?? 'http://localhost:3001';
export const STUDENT_RECORD_URL = process.env.STUDENT_RECORD_URL ?? 'http://localhost:3002';

/** Identity headers injected SERVER-SIDE from the session (never from the client). */
export function identityHeaders(session: Session): Record<string, string> {
  return { 'x-tenant-id': session.tenantId, 'x-user-id': session.staffId };
}

export interface Me {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  isAdmin: boolean;
  orgs: { id: string; name: string; type: string; role: string }[];
}

export interface Licenses {
  tenantId: string;
  products: { product: string; licensed: boolean }[];
}

export async function fetchMe(session: Session): Promise<Me | null> {
  const res = await fetch(`${ROSTER_GRAPH_URL}/api/me`, {
    headers: identityHeaders(session),
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as Me) : null;
}

export async function fetchLicenses(session: Session): Promise<Licenses | null> {
  const res = await fetch(`${ROSTER_GRAPH_URL}/api/licenses`, {
    headers: { 'x-tenant-id': session.tenantId },
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as Licenses) : null;
}

/** Forward an admin provisioning POST to roster-graph with the session identity. */
export async function forwardAdmin(
  session: Session,
  path: string,
  body: string,
): Promise<{ status: number; text: string }> {
  const res = await fetch(`${ROSTER_GRAPH_URL}/api/admin/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...identityHeaders(session) },
    body,
  });
  return { status: res.status, text: await res.text() };
}
