import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cedar from '@cedar-policy/cedar-wasm/nodejs';
import type { EntityJson } from '@cedar-policy/cedar-wasm/nodejs';

// CommonJS build: __dirname is package/dist at runtime and package/src under tsx;
// the cedar/ folder ships alongside (see package.json "files"), so ../cedar resolves
// in both. (The package targets CommonJS so it can be consumed by the Nest services.)
/** The Cedar policy text used for all OnePlatform student-access decisions. */
export const POLICIES: string = readFileSync(resolve(__dirname, '../cedar/policies.cedar'), 'utf8');

export type Action = 'viewStudent' | 'recordStudentData';
export type Decision = 'allow' | 'deny';

/** Principal (staff) projection the policies need. Mirrors roster-graph data. */
export interface StaffEntityInput {
  id: string;
  tenant: string;
  /** TEACHER | SPECIALIST | AIDE | ADMINISTRATOR | DISTRICT_ADMIN */
  role: string;
  /** class sourcedIds the staff member is enrolled in (any non-student role) */
  classes: string[];
  /** school sourcedIds the staff member administers (admins) */
  schools: string[];
}

/** Resource (student) projection the policies need. */
export interface StudentEntityInput {
  id: string;
  tenant: string;
  /** class sourcedIds the student is enrolled in */
  classes: string[];
  school: string;
}

export function staffEntity(s: StaffEntityInput): EntityJson {
  return {
    uid: { type: 'Staff', id: s.id },
    attrs: { tenant: s.tenant, role: s.role, classes: s.classes, schools: s.schools },
    parents: [],
  };
}

export function studentEntity(s: StudentEntityInput): EntityJson {
  return {
    uid: { type: 'Student', id: s.id },
    attrs: { tenant: s.tenant, school: s.school, classes: s.classes },
    parents: [],
  };
}

/**
 * Evaluate a single student-access decision with Cedar.
 * Default-deny: returns 'allow' only if a permit policy matches.
 */
export function isAuthorized(input: {
  staff: StaffEntityInput;
  action: Action;
  student: StudentEntityInput;
}): Decision {
  const answer = cedar.isAuthorized({
    principal: { type: 'Staff', id: input.staff.id },
    action: { type: 'Action', id: input.action },
    resource: { type: 'Student', id: input.student.id },
    context: {},
    policies: { staticPolicies: POLICIES },
    entities: [
      staffEntity(input.staff),
      studentEntity(input.student),
      // Declare the action entity (no schema is supplied).
      { uid: { type: 'Action', id: input.action }, attrs: {}, parents: [] },
    ],
  });

  if (answer.type === 'failure') {
    throw new Error(`Cedar evaluation failed: ${JSON.stringify(answer.errors)}`);
  }
  return answer.response.decision;
}

/** Convenience boolean wrapper. */
export function can(staff: StaffEntityInput, action: Action, student: StudentEntityInput): boolean {
  return isAuthorized({ staff, action, student }) === 'allow';
}

/**
 * Derive the authorized staff set for a student from candidate staff — the
 * authorization-layer equivalent of roster-graph's `access set` endpoint.
 */
export function authorizedStaff(
  candidates: StaffEntityInput[],
  action: Action,
  student: StudentEntityInput,
): string[] {
  return candidates.filter((s) => can(s, action, student)).map((s) => s.id);
}

/** Parse-check the policy set (used in tests/CI to fail fast on policy typos). */
export function policiesParse(): boolean {
  const res = cedar.checkParsePolicySet({ staticPolicies: POLICIES });
  return res.type === 'success';
}
