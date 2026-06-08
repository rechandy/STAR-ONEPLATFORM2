/**
 * STAR OnePlatform — seed script
 * --------------------------------------------------------------------------
 * Ingests the demo datasets into the canonical OneRoster schema:
 *   - data/demo_users.json     (40 teachers, 10 administrators)
 *   - data/star_iep_dataset.csv (1,000 students, 4,267 IEP goals + metrics)
 *
 * It synthesizes the roster graph the raw files imply:
 *   Tenant -> District -> 14 Schools -> 1 Course -> 1 Class per teacher
 *   Teachers + their students enrolled into those classes
 *   Students get StudentProfiles; goals get IepGoal + GoalProgress
 *   Each goal also emits canonical MetricEvent(s) into the outcomes store.
 *
 * Idempotent: every row uses a deterministic id and createMany(skipDuplicates),
 * so re-running tops up without duplicating.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import {
  Prisma,
  PrismaClient,
  OrgType,
  SessionType,
  RoleType,
  IdentifierType,
  GoalDomain,
  GoalStatus,
  MetricSource,
  MetricType,
  EntityStatus,
} from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../data');

// ---- Tenant / fixed ids ----------------------------------------------------
const TENANT_ID = 'star-demo';
const TENANT_SLUG = 'star-demo';
const DISTRICT_ID = 'org-star-demo-district';
const TERM_ID = 'term-2025-2026';
const COURSE_ID = 'course-star-services';
const TERM_START = new Date('2025-08-01');
const TERM_END = new Date('2026-06-30');
const EMAIL_DOMAIN = 'stardemo.org';
const NOW = new Date();

// ---- helpers ---------------------------------------------------------------
const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const familyName = parts.length > 1 ? parts.pop()! : '';
  return { givenName: parts.join(' '), familyName };
};

const orgIdFor = (school: string) => `org-${slug(school)}`;
const classIdFor = (teacherId: string) => `class-${teacherId}`;

const DOMAIN_MAP: Record<string, GoalDomain> = {
  'Academic Readiness': GoalDomain.ACADEMIC_READINESS,
  'Behavior / Self-Regulation': GoalDomain.BEHAVIOR_SELF_REGULATION,
  Communication: GoalDomain.COMMUNICATION,
  'Daily Living': GoalDomain.DAILY_LIVING,
  'Social Skills': GoalDomain.SOCIAL_SKILLS,
};

async function chunkedCreate<T>(
  label: string,
  rows: T[],
  fn: (batch: T[]) => Promise<unknown>,
  size = 1000,
) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
  console.log(`  ✓ ${label}: ${rows.length}`);
}

// ---- types -----------------------------------------------------------------
interface DemoUser { id: string; name: string; school: string; role: string }
interface GoalRow {
  goal_id: string; student_id: string; student_first_name: string;
  student_last_name: string; age: string; grade: string; diagnosis: string;
  school: string; teacher_id: string; teacher_name: string; goal_domain: string;
  goal_description: string; iep_start_date: string; iep_end_date: string;
  days_remaining_to_review: string; total_sessions: string; weeks_in_program: string;
  sessions_per_week: string; baseline_prompt_level: string; current_prompt_level: string;
  prompt_level_change: string; baseline_accuracy: string; current_accuracy: string;
  accuracy_trend_per_week: string; consecutive_progress_sessions: string; goal_met: string;
}

async function main() {
  console.log('Loading source files...');
  const users = JSON.parse(readFileSync(resolve(DATA, 'demo_users.json'), 'utf8')) as {
    teachers: DemoUser[];
    administrators: DemoUser[];
  };
  const goalRows = parse(readFileSync(resolve(DATA, 'star_iep_dataset.csv'), 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as GoalRow[];

  // ---- derive sets ---------------------------------------------------------
  const teacherById = new Map(users.teachers.map((t) => [t.id, t]));
  const schools = new Set<string>();
  users.teachers.forEach((t) => schools.add(t.school));
  users.administrators.forEach((a) => schools.add(a.school));
  goalRows.forEach((r) => schools.add(r.school));

  // distinct students (first row wins for demographics)
  const studentById = new Map<string, GoalRow>();
  for (const r of goalRows) if (!studentById.has(r.student_id)) studentById.set(r.student_id, r);

  // distinct grades for the course
  const grades = [...new Set(goalRows.map((r) => r.grade))];

  console.log(
    `Parsed: ${schools.size} schools, ${users.teachers.length} teachers, ` +
      `${users.administrators.length} admins, ${studentById.size} students, ${goalRows.length} goals`,
  );

  // ==========================================================================
  console.log('\nSeeding tenancy & org hierarchy...');
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, slug: TENANT_SLUG, name: 'STAR Demo District' },
  });

  await prisma.org.upsert({
    where: { id: DISTRICT_ID },
    update: {},
    create: {
      id: DISTRICT_ID, tenantId: TENANT_ID, sourcedId: 'star-demo-district',
      type: OrgType.DISTRICT, name: 'STAR Demo District',
    },
  });

  await chunkedCreate('schools', [...schools], (batch) =>
    prisma.org.createMany({
      skipDuplicates: true,
      data: batch.map((name) => ({
        id: orgIdFor(name), tenantId: TENANT_ID, sourcedId: slug(name),
        type: OrgType.SCHOOL, name, parentId: DISTRICT_ID,
      })),
    }),
  );

  await prisma.academicSession.upsert({
    where: { id: TERM_ID },
    update: {},
    create: {
      id: TERM_ID, tenantId: TENANT_ID, sourcedId: '2025-2026',
      title: '2025–2026 School Year', type: SessionType.SCHOOL_YEAR,
      schoolYear: '2025', startDate: TERM_START, endDate: TERM_END,
    },
  });

  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {},
    create: {
      id: COURSE_ID, tenantId: TENANT_ID, sourcedId: 'star-services',
      title: 'Specialized Instruction (STAR)', courseCode: 'STAR-SVC',
      grades, subjectArea: 'Special Education', orgId: DISTRICT_ID,
    },
  });

  // ==========================================================================
  console.log('\nSeeding users, identifiers & org memberships...');
  type UserSeed = { id: string; given: string; family: string; role: RoleType; school: string; legacy: string };
  const allUsers: UserSeed[] = [];

  for (const t of users.teachers) {
    const { givenName, familyName } = splitName(t.name);
    allUsers.push({ id: t.id, given: givenName, family: familyName, role: RoleType.TEACHER, school: t.school, legacy: t.id });
  }
  for (const a of users.administrators) {
    const { givenName, familyName } = splitName(a.name);
    allUsers.push({ id: a.id, given: givenName, family: familyName, role: RoleType.ADMINISTRATOR, school: a.school, legacy: a.id });
  }
  for (const [sid, r] of studentById) {
    allUsers.push({ id: sid, given: r.student_first_name, family: r.student_last_name, role: RoleType.STUDENT, school: r.school, legacy: sid });
  }

  await chunkedCreate('users', allUsers, (batch) =>
    prisma.user.createMany({
      skipDuplicates: true,
      data: batch.map((u) => ({
        id: u.id, tenantId: TENANT_ID, sourcedId: u.legacy, username: u.legacy,
        givenName: u.given, familyName: u.family,
        email: `${slug(u.given)}.${slug(u.family)}.${u.legacy.toLowerCase()}@${EMAIL_DOMAIN}`,
        primaryRole: u.role,
      })),
    }),
  );

  // identifiers: legacy STAR id + email (the matching backbone)
  const identifiers = allUsers.flatMap((u) => [
    { id: `uid-${u.id}-legacy`, tenantId: TENANT_ID, userId: u.id, type: IdentifierType.STAR_LEGACY_ID, value: u.legacy },
  ]);
  await chunkedCreate('user identifiers', identifiers, (batch) =>
    prisma.userIdentifier.createMany({ skipDuplicates: true, data: batch }),
  );

  const memberships = allUsers.map((u) => ({
    id: `om-${u.id}`, tenantId: TENANT_ID, userId: u.id, orgId: orgIdFor(u.school),
    role: u.role, isPrimary: true,
  }));
  await chunkedCreate('org memberships', memberships, (batch) =>
    prisma.orgMembership.createMany({ skipDuplicates: true, data: batch }),
  );

  // ==========================================================================
  console.log('\nSeeding classes & enrollments...');
  // one class per teacher (their caseload), at the teacher's school
  const classes = users.teachers.map((t) => ({
    id: classIdFor(t.id), tenantId: TENANT_ID, sourcedId: classIdFor(t.id),
    title: `${t.name} – Caseload`, classCode: t.id, classType: 'homeroom',
    courseId: COURSE_ID, schoolId: orgIdFor(t.school), termId: TERM_ID,
  }));
  await chunkedCreate('classes', classes, (batch) =>
    prisma.class.createMany({ skipDuplicates: true, data: batch }),
  );

  // enrollments: teachers into their class
  const enrollments: Prisma.EnrollmentCreateManyInput[] = users.teachers.map((t) => ({
    id: `enr-${t.id}`, tenantId: TENANT_ID, sourcedId: `enr-${t.id}`,
    userId: t.id, classId: classIdFor(t.id), role: RoleType.TEACHER,
    isPrimary: true, beginDate: TERM_START, endDate: TERM_END,
  }));
  // students into their teacher's class
  for (const [sid, r] of studentById) {
    if (!teacherById.has(r.teacher_id)) continue;
    enrollments.push({
      id: `enr-${sid}`, tenantId: TENANT_ID, sourcedId: `enr-${sid}`,
      userId: sid, classId: classIdFor(r.teacher_id), role: RoleType.STUDENT,
      isPrimary: true, beginDate: TERM_START, endDate: TERM_END,
    });
  }
  await chunkedCreate('enrollments', enrollments, (batch) =>
    prisma.enrollment.createMany({ skipDuplicates: true, data: batch }),
  );

  // ==========================================================================
  console.log('\nSeeding student profiles...');
  const profiles = [...studentById.entries()].map(([sid, r]) => ({
    id: `sp-${sid}`, tenantId: TENANT_ID, userId: sid,
    grade: r.grade, age: Number(r.age) || null, primaryDiagnosis: r.diagnosis,
  }));
  await chunkedCreate('student profiles', profiles, (batch) =>
    prisma.studentProfile.createMany({ skipDuplicates: true, data: batch }),
  );

  // ==========================================================================
  console.log('\nSeeding IEP goals, progress & metric events...');
  const goals = goalRows.map((r) => ({
    id: r.goal_id, tenantId: TENANT_ID, sourcedId: r.goal_id,
    studentId: `sp-${r.student_id}`, authoredById: r.teacher_id,
    classId: teacherById.has(r.teacher_id) ? classIdFor(r.teacher_id) : null,
    domain: DOMAIN_MAP[r.goal_domain] ?? GoalDomain.ACADEMIC_READINESS,
    description: r.goal_description,
    iepStartDate: new Date(r.iep_start_date), iepEndDate: new Date(r.iep_end_date),
    daysRemainingToReview: Number(r.days_remaining_to_review) || null,
    status: r.goal_met === '1' ? GoalStatus.MET : GoalStatus.ACTIVE,
    goalMet: r.goal_met === '1',
  }));
  await chunkedCreate('iep goals', goals, (batch) =>
    prisma.iepGoal.createMany({ skipDuplicates: true, data: batch }),
  );

  const progress = goalRows.map((r) => ({
    id: `gp-${r.goal_id}`, tenantId: TENANT_ID, goalId: r.goal_id,
    totalSessions: Number(r.total_sessions), weeksInProgram: Number(r.weeks_in_program),
    sessionsPerWeek: Number(r.sessions_per_week),
    baselinePromptLevel: Number(r.baseline_prompt_level),
    currentPromptLevel: Number(r.current_prompt_level),
    promptLevelChange: Number(r.prompt_level_change),
    baselineAccuracy: Number(r.baseline_accuracy),
    currentAccuracy: Number(r.current_accuracy),
    accuracyTrendPerWeek: Number(r.accuracy_trend_per_week),
    consecutiveProgressSessions: Number(r.consecutive_progress_sessions),
    goalMet: r.goal_met === '1', lastEvaluatedAt: NOW,
  }));
  await chunkedCreate('goal progress', progress, (batch) =>
    prisma.goalProgress.createMany({ skipDuplicates: true, data: batch }),
  );

  // Canonical outcome events — what every pillar + the lakehouse consume.
  const events = goalRows.flatMap((r) => {
    const hasTeacher = teacherById.has(r.teacher_id);
    const base = {
      tenantId: TENANT_ID, source: MetricSource.SOLER, studentId: `sp-${r.student_id}`,
      goalId: r.goal_id, classId: hasTeacher ? classIdFor(r.teacher_id) : null,
      recordedById: hasTeacher ? r.teacher_id : null, occurredAt: NOW, schemaVersion: 1,
    };
    const list: Prisma.MetricEventCreateManyInput[] = [
      {
        ...base, id: `me-${r.goal_id}-acc`, idempotencyKey: `${r.goal_id}:accuracy:v1`,
        metricType: MetricType.ACCURACY_SNAPSHOT,
        value: {
          baselineAccuracy: Number(r.baseline_accuracy),
          currentAccuracy: Number(r.current_accuracy),
          accuracyTrendPerWeek: Number(r.accuracy_trend_per_week),
          currentPromptLevel: Number(r.current_prompt_level),
          domain: r.goal_domain,
        },
      },
    ];
    if (r.goal_met === '1') {
      list.push({
        ...base, id: `me-${r.goal_id}-met`, idempotencyKey: `${r.goal_id}:mastered:v1`,
        metricType: MetricType.OBJECTIVE_MASTERED,
        value: { goalMet: true, domain: r.goal_domain },
      });
    }
    return list;
  });
  await chunkedCreate('metric events', events, (batch) =>
    prisma.metricEvent.createMany({ skipDuplicates: true, data: batch }),
  );

  // ---- summary -------------------------------------------------------------
  console.log('\n✅ Seed complete. Tenant counts:');
  const where = { tenantId: TENANT_ID };
  console.table({
    orgs: await prisma.org.count({ where }),
    users: await prisma.user.count({ where }),
    classes: await prisma.class.count({ where }),
    enrollments: await prisma.enrollment.count({ where }),
    studentProfiles: await prisma.studentProfile.count({ where }),
    iepGoals: await prisma.iepGoal.count({ where }),
    goalProgress: await prisma.goalProgress.count({ where }),
    metricEvents: await prisma.metricEvent.count({ where }),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// silence unused import in some toolchains
void EntityStatus;
