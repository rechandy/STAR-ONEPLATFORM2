import type { Session } from '@/lib/auth/session';

export const ROSTER_GRAPH_URL = process.env.ROSTER_GRAPH_URL ?? 'http://localhost:3001';
export const STUDENT_RECORD_URL = process.env.STUDENT_RECORD_URL ?? 'http://localhost:3002';
export const LINKS_URL = process.env.LINKS_URL ?? 'http://localhost:3004';
export const PREDICT_URL = process.env.PREDICT_URL ?? 'http://localhost:3005';

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

export interface CurriculumObjectiveSummary {
  id: string;
  domain: string;
  code: string;
  title: string;
  description: string | null;
  sequence: number;
  lessonCount: number;
}

export interface ScopeSequence {
  count: number;
  objectives: CurriculumObjectiveSummary[];
}

/** Links curriculum scope & sequence (read model the assignments are built from). */
export async function fetchScopeSequence(session: Session): Promise<ScopeSequence | null> {
  const res = await fetch(`${LINKS_URL}/api/curriculum/scope-sequence`, {
    headers: identityHeaders(session),
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as ScopeSequence) : null;
}

// ---- Prediction service (IEP goal-attainment risk) ------------------------
export type RiskBand = 'green' | 'yellow' | 'red';

export interface GoalPrediction {
  goalId: string;
  domain: string;
  description: string;
  currentAccuracy: number | null;
  currentPromptLevel: number | null;
  probability: number;
  band: RiskBand;
  label: string;
  action: string;
}
export interface RiskSummary {
  total: number;
  counts: Record<RiskBand, number>;
  worstBand: RiskBand;
}
export interface StudentPredictions {
  studentId: string;
  name: string;
  grade: string;
  age: number | null;
  diagnosis: string;
  summary: RiskSummary;
  goals: GoalPrediction[];
}
export interface RosterRiskEntry {
  studentId: string;
  name: string;
  grade: string;
  summary: RiskSummary;
}
export interface AtRiskInsights {
  totalGoals: number;
  students: number;
  distribution: Record<RiskBand, number>;
  pct: Record<RiskBand, number>;
  topAtRisk: { studentId: string; name: string; red: number; yellow: number; green: number; n: number }[];
}

export async function fetchStudentPredictions(session: Session, studentId: string): Promise<StudentPredictions | null> {
  const res = await fetch(`${PREDICT_URL}/api/students/${encodeURIComponent(studentId)}/predictions`, {
    headers: identityHeaders(session), cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as StudentPredictions) : null;
}

export async function fetchRosterPredictions(session: Session): Promise<{ count: number; students: RosterRiskEntry[] } | null> {
  const res = await fetch(`${PREDICT_URL}/api/roster/predictions`, {
    headers: identityHeaders(session), cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as { count: number; students: RosterRiskEntry[] }) : null;
}

export async function fetchAtRiskInsights(session: Session): Promise<AtRiskInsights | null> {
  const res = await fetch(`${PREDICT_URL}/api/insights/at-risk?limit=12`, {
    headers: identityHeaders(session), cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as AtRiskInsights) : null;
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
