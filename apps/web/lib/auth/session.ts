import { cookies } from 'next/headers';

export interface Session {
  staffId: string;
  tenantId: string;
}

export const SESSION_COOKIE = 'op_session';

/**
 * Demo session: a base64 JSON cookie. In production this is a signed/encrypted
 * session (or JWT) issued by IAM after SSO — never trusted from the client.
 */
export function getSession(): Session | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as Session;
    if (!parsed.staffId || !parsed.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s)).toString('base64');
}
