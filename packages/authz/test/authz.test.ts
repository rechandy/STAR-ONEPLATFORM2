import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizedStaff,
  can,
  policiesParse,
  type StaffEntityInput,
  type StudentEntityInput,
} from '../src/index';

// Fixtures mirror the verified roster-graph access set for student S00001
// (Meadowbrook Academy): primary teacher T0026 + co-teacher + SLP/OT/BCBA.
const TENANT = 'star-demo';
const T = {
  acad: 'class-T0026-acad',
  behav: 'class-T0026-behav',
  comm: 'class-T0026-comm',
  daily: 'class-T0026-daily',
  social: 'class-T0026-social',
};
const CASELOAD = {
  slp: 'class-SLP003-meadowbrook-academy',
  ot: 'class-OT003-meadowbrook-academy',
  bx: 'class-BX001-meadowbrook-academy',
};

const student: StudentEntityInput = {
  id: 'S00001',
  tenant: TENANT,
  school: 'meadowbrook-academy',
  classes: [...Object.values(T), ...Object.values(CASELOAD)],
};

const primaryTeacher: StaffEntityInput = {
  id: 'T0026',
  tenant: TENANT,
  role: 'TEACHER',
  classes: Object.values(T),
  schools: [],
};
const coTeacher: StaffEntityInput = {
  id: 'T0028',
  tenant: TENANT,
  role: 'TEACHER',
  classes: [T.acad, 'class-T0028-comm'], // co-teaches T0026's Academic Readiness section
  schools: [],
};
const slp: StaffEntityInput = {
  id: 'SLP003',
  tenant: TENANT,
  role: 'SPECIALIST',
  classes: [CASELOAD.slp, 'class-SLP003-bridgewood-school'],
  schools: [],
};
const ot: StaffEntityInput = {
  id: 'OT003',
  tenant: TENANT,
  role: 'SPECIALIST',
  classes: [CASELOAD.ot],
  schools: [],
};
const bcba: StaffEntityInput = {
  id: 'BX001',
  tenant: TENANT,
  role: 'SPECIALIST',
  classes: [CASELOAD.bx],
  schools: [],
};
// Specialist who covers OTHER schools — must NOT reach S00001.
const slpOtherSchools: StaffEntityInput = {
  id: 'SLP001',
  tenant: TENANT,
  role: 'SPECIALIST',
  classes: ['class-SLP001-northstar-academy', 'class-SLP001-sunrise-elementary'],
  schools: [],
};
// Unrelated teacher at another school.
const unrelatedTeacher: StaffEntityInput = {
  id: 'T0001',
  tenant: TENANT,
  role: 'TEACHER',
  classes: ['class-T0001-comm'],
  schools: [],
};
const districtAdmin: StaffEntityInput = {
  id: 'A0001',
  tenant: TENANT,
  role: 'DISTRICT_ADMIN',
  classes: [],
  schools: [],
};
const schoolAdminMeadow: StaffEntityInput = {
  id: 'A0001-meadow',
  tenant: TENANT,
  role: 'ADMINISTRATOR',
  classes: [],
  schools: ['meadowbrook-academy'],
};
const schoolAdminOther: StaffEntityInput = {
  id: 'A0008',
  tenant: TENANT,
  role: 'ADMINISTRATOR',
  classes: [],
  schools: ['northstar-academy'],
};
// Same class id strings but a DIFFERENT tenant — must be denied.
const crossTenant: StaffEntityInput = {
  id: 'X0001',
  tenant: 'other-isd',
  role: 'TEACHER',
  classes: Object.values(T),
  schools: [],
};

describe('policies', () => {
  it('parse cleanly', () => {
    assert.equal(policiesParse(), true);
  });
});

describe('viewStudent — shared-class access', () => {
  it('allows the primary teacher', () => {
    assert.ok(can(primaryTeacher, 'viewStudent', student));
  });
  it('allows a co-teacher of a shared section', () => {
    assert.ok(can(coTeacher, 'viewStudent', student));
  });
  it('allows SLP, OT, and BCBA on the student caseloads', () => {
    assert.ok(can(slp, 'viewStudent', student));
    assert.ok(can(ot, 'viewStudent', student));
    assert.ok(can(bcba, 'viewStudent', student));
  });
  it('denies a specialist who covers other schools', () => {
    assert.equal(can(slpOtherSchools, 'viewStudent', student), false);
  });
  it('denies an unrelated teacher', () => {
    assert.equal(can(unrelatedTeacher, 'viewStudent', student), false);
  });
  it('denies cross-tenant staff even with identical class ids', () => {
    assert.equal(can(crossTenant, 'viewStudent', student), false);
  });
});

describe('viewStudent — admin overrides', () => {
  it('allows a district admin within tenant', () => {
    assert.ok(can(districtAdmin, 'viewStudent', student));
  });
  it("allows a school admin of the student's school", () => {
    assert.ok(can(schoolAdminMeadow, 'viewStudent', student));
  });
  it('denies a school admin of another school', () => {
    assert.equal(can(schoolAdminOther, 'viewStudent', student), false);
  });
});

describe('recordStudentData — narrower than view', () => {
  it('allows instructional staff who share a class', () => {
    assert.ok(can(primaryTeacher, 'recordStudentData', student));
    assert.ok(can(slp, 'recordStudentData', student));
  });
  it('denies admins (no data-entry from admin rules)', () => {
    assert.equal(can(districtAdmin, 'recordStudentData', student), false);
    assert.equal(can(schoolAdminMeadow, 'recordStudentData', student), false);
  });
  it('denies unrelated staff', () => {
    assert.equal(can(unrelatedTeacher, 'recordStudentData', student), false);
  });
});

describe('authorized staff set matches the roster access set', () => {
  it('returns exactly the 5 instructional staff for S00001', () => {
    const candidates = [
      primaryTeacher,
      coTeacher,
      slp,
      ot,
      bcba,
      slpOtherSchools,
      unrelatedTeacher,
    ];
    const allowed = authorizedStaff(candidates, 'viewStudent', student).sort();
    assert.deepEqual(allowed, ['BX001', 'OT003', 'SLP003', 'T0026', 'T0028'].sort());
  });
});
