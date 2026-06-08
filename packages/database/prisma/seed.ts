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
  ServiceDiscipline,
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

const DOMAIN_MAP: Record<string, GoalDomain> = {
  'Academic Readiness': GoalDomain.ACADEMIC_READINESS,
  'Behavior / Self-Regulation': GoalDomain.BEHAVIOR_SELF_REGULATION,
  Communication: GoalDomain.COMMUNICATION,
  'Daily Living': GoalDomain.DAILY_LIVING,
  'Social Skills': GoalDomain.SOCIAL_SKILLS,
};

// Per-domain metadata for the Links curriculum courses + section ids.
const DOMAIN_META: Record<GoalDomain, { code: string; label: string }> = {
  [GoalDomain.ACADEMIC_READINESS]: { code: 'acad', label: 'Academic Readiness' },
  [GoalDomain.BEHAVIOR_SELF_REGULATION]: { code: 'behav', label: 'Behavior / Self-Regulation' },
  [GoalDomain.COMMUNICATION]: { code: 'comm', label: 'Communication' },
  [GoalDomain.DAILY_LIVING]: { code: 'daily', label: 'Daily Living' },
  [GoalDomain.SOCIAL_SKILLS]: { code: 'social', label: 'Social Skills' },
};

const courseIdFor = (d: GoalDomain) => `course-${DOMAIN_META[d].code}`;
// A section is a (teacher x domain) class; this is the many-to-many anchor.
const sectionIdFor = (teacherId: string, d: GoalDomain) =>
  `class-${teacherId}-${DOMAIN_META[d].code}`;
const domainOf = (raw: string): GoalDomain =>
  DOMAIN_MAP[raw] ?? GoalDomain.ACADEMIC_READINESS;

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

  // One district-level Links course per instructional domain. Sections (classes)
  // are sections of these courses.
  await prisma.course.createMany({
    skipDuplicates: true,
    data: (Object.keys(DOMAIN_META) as GoalDomain[]).map((d) => ({
      id: courseIdFor(d), tenantId: TENANT_ID, sourcedId: DOMAIN_META[d].code,
      title: `Links: ${DOMAIN_META[d].label}`, courseCode: `LINKS-${DOMAIN_META[d].code.toUpperCase()}`,
      grades, subjectArea: DOMAIN_META[d].label, orgId: DISTRICT_ID,
    })),
  });
  console.log(`  ✓ courses: ${Object.keys(DOMAIN_META).length}`);

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
  // Many-to-many roster: a SECTION = (teacher x domain). A teacher runs many
  // sections; a student is rostered into one section per domain they have goals
  // in -> a student belongs to MANY classes. Both directions via Enrollment.
  console.log('\nSeeding sections (classes) & enrollments...');

  // Derive the set of sections actually present in the data.
  const sectionKeys = new Map<string, { teacherId: string; domain: GoalDomain }>();
  // Derive distinct student<->section memberships present in the data.
  const studentSectionKeys = new Map<string, { studentId: string; teacherId: string; domain: GoalDomain }>();
  for (const r of goalRows) {
    if (!teacherById.has(r.teacher_id)) continue;
    const domain = domainOf(r.goal_domain);
    sectionKeys.set(`${r.teacher_id}|${domain}`, { teacherId: r.teacher_id, domain });
    studentSectionKeys.set(`${r.student_id}|${r.teacher_id}|${domain}`, {
      studentId: r.student_id, teacherId: r.teacher_id, domain,
    });
  }

  const classes: Prisma.ClassCreateManyInput[] = [...sectionKeys.values()].map(
    ({ teacherId, domain }) => {
      const t = teacherById.get(teacherId)!;
      const id = sectionIdFor(teacherId, domain);
      return {
        id, tenantId: TENANT_ID, sourcedId: id,
        title: `${t.name} – ${DOMAIN_META[domain].label}`,
        classCode: `${teacherId}-${DOMAIN_META[domain].code}`, classType: 'section',
        focusDomain: domain, courseId: courseIdFor(domain),
        schoolId: orgIdFor(t.school), termId: TERM_ID,
      };
    },
  );
  await chunkedCreate('sections (classes)', classes, (batch) =>
    prisma.class.createMany({ skipDuplicates: true, data: batch }),
  );

  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  // teachers -> each of their sections
  for (const { teacherId, domain } of sectionKeys.values()) {
    const classId = sectionIdFor(teacherId, domain);
    enrollments.push({
      id: `enr-${teacherId}-${classId}`, tenantId: TENANT_ID, sourcedId: `enr-${teacherId}-${classId}`,
      userId: teacherId, classId, role: RoleType.TEACHER,
      isPrimary: true, beginDate: TERM_START, endDate: TERM_END,
    });
  }
  // students -> every section in which they have a goal (many classes per student)
  for (const { studentId, teacherId, domain } of studentSectionKeys.values()) {
    const classId = sectionIdFor(teacherId, domain);
    enrollments.push({
      id: `enr-${studentId}-${classId}`, tenantId: TENANT_ID, sourcedId: `enr-${studentId}-${classId}`,
      userId: studentId, classId, role: RoleType.STUDENT,
      isPrimary: false, beginDate: TERM_START, endDate: TERM_END,
    });
  }
  await chunkedCreate('enrollments', enrollments, (batch) =>
    prisma.enrollment.createMany({ skipDuplicates: true, data: batch }),
  );

  // ==========================================================================
  // CROSS-TEACHER ACCESS: co-teaching + related-service specialists (SLP/OT/BCBA).
  // Students are served by their primary teacher AND additional staff, so the
  // permissions model must grant access across teachers and across schools.
  console.log('\nSeeding co-teaching & related-service specialists...');

  // per-student domains (which related services a student could need)
  const studentDomains = new Map<string, Set<GoalDomain>>();
  for (const r of goalRows) {
    const set = studentDomains.get(r.student_id) ?? new Set<GoalDomain>();
    set.add(domainOf(r.goal_domain));
    studentDomains.set(r.student_id, set);
  }
  // each teacher's section domains (sorted for deterministic pairing)
  const teacherDomains = new Map<string, GoalDomain[]>();
  for (const { teacherId, domain } of sectionKeys.values()) {
    const arr = teacherDomains.get(teacherId) ?? [];
    arr.push(domain);
    teacherDomains.set(teacherId, arr);
  }
  for (const arr of teacherDomains.values()) arr.sort();

  const crossEnrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const enr = (userId: string, classId: string, role: RoleType, isPrimary = false) => ({
    id: `enr-${userId}-${classId}`, tenantId: TENANT_ID, sourcedId: `enr-${userId}-${classId}`,
    userId, classId, role, isPrimary, beginDate: TERM_START, endDate: TERM_END,
  });

  // --- (A) Co-teaching: within each school, pair teachers; each co-teaches one
  //         of the other's sections -> two TEACHERS share one class. -----------
  const teachersBySchool = new Map<string, string[]>();
  for (const t of users.teachers) {
    const arr = teachersBySchool.get(t.school) ?? [];
    arr.push(t.id);
    teachersBySchool.set(t.school, arr);
  }
  let coTeachCount = 0;
  for (const ids of teachersBySchool.values()) {
    const sorted = [...ids].sort();
    for (let i = 0; i + 1 < sorted.length; i += 2) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aDomains = teacherDomains.get(a);
      const bDomains = teacherDomains.get(b);
      if (aDomains?.length) {
        crossEnrollments.push(enr(b, sectionIdFor(a, aDomains[0]), RoleType.TEACHER));
        coTeachCount++;
      }
      if (bDomains?.length) {
        crossEnrollments.push(enr(a, sectionIdFor(b, bDomains[0]), RoleType.TEACHER));
        coTeachCount++;
      }
    }
  }

  // --- (B) Related-service specialists: traveling SLP/OT/BCBA providers -------
  interface DiscCfg {
    prefix: string;
    discipline: ServiceDiscipline;
    domain: GoalDomain;
    courseId: string;
    courseTitle: string;
    sectionLabel: string;
    names: string[];
  }
  const SPECIALISTS: DiscCfg[] = [
    {
      prefix: 'SLP', discipline: ServiceDiscipline.SPEECH_LANGUAGE, domain: GoalDomain.COMMUNICATION,
      courseId: 'course-rs-slp', courseTitle: 'Related Service: Speech-Language Therapy',
      sectionLabel: 'Speech Therapy', names: ['Jordan Rivers', 'Maya Brooks', 'Devin Patel', 'Sara Lindqvist'],
    },
    {
      prefix: 'OT', discipline: ServiceDiscipline.OCCUPATIONAL_THERAPY, domain: GoalDomain.DAILY_LIVING,
      courseId: 'course-rs-ot', courseTitle: 'Related Service: Occupational Therapy',
      sectionLabel: 'Occupational Therapy', names: ['Noah Bennett', 'Priya Shah', 'Marcus Webb', 'Hannah Cole'],
    },
    {
      prefix: 'BX', discipline: ServiceDiscipline.BEHAVIOR, domain: GoalDomain.BEHAVIOR_SELF_REGULATION,
      courseId: 'course-rs-bx', courseTitle: 'Related Service: Behavior Support',
      sectionLabel: 'Behavior Support', names: ['Alexis Stone', 'Grace Okafor', 'Daniel Cho'],
    },
  ];
  const CASELOAD_CAP = 25; // per (specialist x school) — keeps caseloads realistic

  const schoolList = [...schools].sort();
  const specialistUsers: Prisma.UserCreateManyInput[] = [];
  const specialistIdentifiers: Prisma.UserIdentifierCreateManyInput[] = [];
  const specialistMemberships: Prisma.OrgMembershipCreateManyInput[] = [];
  const disciplineCourses: Prisma.CourseCreateManyInput[] = [];
  const caseloadSections: Prisma.ClassCreateManyInput[] = [];
  const caseloadCounts = new Map<string, number>();

  for (const cfg of SPECIALISTS) {
    disciplineCourses.push({
      id: cfg.courseId, tenantId: TENANT_ID, sourcedId: cfg.courseId.replace('course-', ''),
      title: cfg.courseTitle, courseCode: cfg.prefix, grades, subjectArea: cfg.sectionLabel, orgId: DISTRICT_ID,
    });

    const specIds: string[] = [];
    cfg.names.forEach((name, i) => {
      const id = `${cfg.prefix}${String(i + 1).padStart(3, '0')}`;
      specIds.push(id);
      const { givenName, familyName } = splitName(name);
      specialistUsers.push({
        id, tenantId: TENANT_ID, sourcedId: id, username: id, givenName, familyName,
        email: `${slug(givenName)}.${slug(familyName)}.${id.toLowerCase()}@${EMAIL_DOMAIN}`,
        primaryRole: RoleType.SPECIALIST, staffDiscipline: cfg.discipline,
      });
      specialistIdentifiers.push({
        id: `uid-${id}-legacy`, tenantId: TENANT_ID, userId: id,
        type: IdentifierType.STAR_LEGACY_ID, value: id,
      });
    });

    // assign schools round-robin -> each school served by one specialist of this discipline
    const schoolToSpec = new Map<string, string>();
    schoolList.forEach((school, idx) => {
      const specId = specIds[idx % specIds.length];
      schoolToSpec.set(school, specId);
      const schoolSlug = slug(school);
      const classId = `class-${specId}-${schoolSlug}`;
      specialistMemberships.push({
        id: `om-${specId}-${schoolSlug}`, tenantId: TENANT_ID, userId: specId,
        orgId: orgIdFor(school), role: RoleType.SPECIALIST, isPrimary: false,
      });
      caseloadSections.push({
        id: classId, tenantId: TENANT_ID, sourcedId: classId,
        title: `${cfg.sectionLabel} – ${school}`, classCode: `${specId}-${schoolSlug}`,
        classType: 'related_service', focusDomain: cfg.domain, discipline: cfg.discipline,
        courseId: cfg.courseId, schoolId: orgIdFor(school), termId: TERM_ID,
      });
      crossEnrollments.push(enr(specId, classId, RoleType.SPECIALIST, true));
    });

    // co-enroll students with a goal in this domain into their school's caseload (capped)
    for (const [sid, r] of studentById) {
      if (!studentDomains.get(sid)?.has(cfg.domain)) continue;
      const specId = schoolToSpec.get(r.school);
      if (!specId) continue;
      const classId = `class-${specId}-${slug(r.school)}`;
      const cnt = caseloadCounts.get(classId) ?? 0;
      if (cnt >= CASELOAD_CAP) continue;
      caseloadCounts.set(classId, cnt + 1);
      crossEnrollments.push(enr(sid, classId, RoleType.STUDENT, false));
    }
  }

  await chunkedCreate('specialists', specialistUsers, (b) =>
    prisma.user.createMany({ skipDuplicates: true, data: b }),
  );
  await chunkedCreate('specialist identifiers', specialistIdentifiers, (b) =>
    prisma.userIdentifier.createMany({ skipDuplicates: true, data: b }),
  );
  await chunkedCreate('specialist memberships', specialistMemberships, (b) =>
    prisma.orgMembership.createMany({ skipDuplicates: true, data: b }),
  );
  await chunkedCreate('related-service courses', disciplineCourses, (b) =>
    prisma.course.createMany({ skipDuplicates: true, data: b }),
  );
  await chunkedCreate('caseload sections', caseloadSections, (b) =>
    prisma.class.createMany({ skipDuplicates: true, data: b }),
  );
  console.log(`  (co-teaching enrollments: ${coTeachCount})`);
  await chunkedCreate('cross-teacher enrollments', crossEnrollments, (b) =>
    prisma.enrollment.createMany({ skipDuplicates: true, data: b }),
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
  // Links curriculum objectives — derive one objective per distinct
  // (domain, goal description). Each IEP goal then links to a real objective.
  console.log('\nSeeding Links curriculum objectives...');
  const objectiveByKey = new Map<string, { id: string; domain: GoalDomain; title: string; code: string }>();
  const perDomainSeq = new Map<GoalDomain, number>();
  for (const r of goalRows) {
    const domain = domainOf(r.goal_domain);
    const key = `${domain}||${r.goal_description}`;
    if (objectiveByKey.has(key)) continue;
    const seq = (perDomainSeq.get(domain) ?? 0) + 1;
    perDomainSeq.set(domain, seq);
    const code = `LINKS-${DOMAIN_META[domain].code.toUpperCase()}-${String(seq).padStart(3, '0')}`;
    objectiveByKey.set(key, { id: `obj-${code}`, domain, title: r.goal_description, code });
  }
  const objectiveIdForRow = (r: GoalRow) =>
    objectiveByKey.get(`${domainOf(r.goal_domain)}||${r.goal_description}`)!.id;

  const objectives = [...objectiveByKey.values()].map((o) => ({
    id: o.id, tenantId: TENANT_ID, sourcedId: o.code, domain: o.domain,
    code: o.code, title: o.title, courseId: courseIdFor(o.domain),
    sequence: Number(o.code.slice(-3)),
  }));
  await chunkedCreate('curriculum objectives', objectives, (batch) =>
    prisma.curriculumObjective.createMany({ skipDuplicates: true, data: batch }),
  );

  // ==========================================================================
  console.log('\nSeeding IEP goals, progress & metric events...');
  const goals = goalRows.map((r) => ({
    id: r.goal_id, tenantId: TENANT_ID, sourcedId: r.goal_id,
    studentId: `sp-${r.student_id}`, authoredById: r.teacher_id,
    classId: teacherById.has(r.teacher_id)
      ? sectionIdFor(r.teacher_id, domainOf(r.goal_domain))
      : null,
    domain: domainOf(r.goal_domain),
    description: r.goal_description,
    curriculumObjectiveId: objectiveIdForRow(r),
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
      goalId: r.goal_id,
      classId: hasTeacher ? sectionIdFor(r.teacher_id, domainOf(r.goal_domain)) : null,
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
  const teacherEnr = await prisma.enrollment.count({ where: { ...where, role: RoleType.TEACHER } });
  const studentEnr = await prisma.enrollment.count({ where: { ...where, role: RoleType.STUDENT } });
  const specialistEnr = await prisma.enrollment.count({ where: { ...where, role: RoleType.SPECIALIST } });
  console.table({
    orgs: await prisma.org.count({ where }),
    courses: await prisma.course.count({ where }),
    users: await prisma.user.count({ where }),
    '  ↳ specialists (SLP/OT/BCBA)': await prisma.user.count({ where: { ...where, primaryRole: RoleType.SPECIALIST } }),
    'classes (sections)': await prisma.class.count({ where }),
    '  ↳ related-service caseloads': await prisma.class.count({ where: { ...where, discipline: { not: null } } }),
    enrollments: await prisma.enrollment.count({ where }),
    '  ↳ teacher enrollments': teacherEnr,
    '  ↳ specialist enrollments': specialistEnr,
    '  ↳ student enrollments': studentEnr,
    studentProfiles: await prisma.studentProfile.count({ where }),
    curriculumObjectives: await prisma.curriculumObjective.count({ where }),
    iepGoals: await prisma.iepGoal.count({ where }),
    '  ↳ linked to an objective': await prisma.iepGoal.count({
      where: { ...where, curriculumObjectiveId: { not: null } },
    }),
    goalProgress: await prisma.goalProgress.count({ where }),
    metricEvents: await prisma.metricEvent.count({ where }),
  });

  // ---- many-to-many check --------------------------------------------------
  const sample = await prisma.enrollment.findFirst({
    where: { ...where, role: RoleType.STUDENT },
    select: { userId: true },
  });
  if (sample) {
    const classesForStudent = await prisma.enrollment.count({
      where: { ...where, userId: sample.userId, role: RoleType.STUDENT },
    });
    const sectionsForTeacher = await prisma.enrollment.groupBy({
      by: ['userId'],
      where: { ...where, role: RoleType.TEACHER },
      _count: { classId: true },
      orderBy: { _count: { classId: 'desc' } },
      take: 1,
    });
    console.log(
      `\nM:N check → student ${sample.userId} is rostered in ${classesForStudent} classes; ` +
        `busiest teacher runs ${sectionsForTeacher[0]?._count.classId ?? 0} sections.`,
    );
  }

  // ---- permissions-model check: cross-teacher access -----------------------
  // How many students are reachable by MORE THAN ONE distinct staff member
  // (primary teacher + co-teacher and/or specialist) via shared classes?
  const multiStaff = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM (
      SELECT se.user_id
      FROM enrollment se
      JOIN enrollment te ON te.class_id = se.class_id AND te.role <> 'STUDENT'
      WHERE se.role = 'STUDENT' AND se.tenant_id = ${TENANT_ID}
      GROUP BY se.user_id
      HAVING count(DISTINCT te.user_id) > 1
    ) x;`;
  console.log(
    `Permissions check → ${multiStaff[0]?.count ?? 0} students are accessible by 2+ distinct staff.`,
  );

  // Show the staff who can access one specialist-served student.
  const served = await prisma.enrollment.findFirst({
    where: { ...where, role: RoleType.STUDENT, class: { is: { discipline: { not: null } } } },
    select: { userId: true },
  });
  if (served) {
    const studentClasses = await prisma.enrollment.findMany({
      where: { ...where, userId: served.userId, role: RoleType.STUDENT },
      select: { classId: true },
    });
    const staff = await prisma.enrollment.findMany({
      where: {
        ...where,
        classId: { in: studentClasses.map((c) => c.classId) },
        role: { not: RoleType.STUDENT },
      },
      include: { user: { select: { givenName: true, familyName: true, primaryRole: true, staffDiscipline: true } }, class: { select: { title: true } } },
    });
    const seen = new Set<string>();
    console.log(`\nStaff with access to student ${served.userId} (cross-teacher):`);
    for (const s of staff) {
      if (seen.has(s.userId)) continue;
      seen.add(s.userId);
      const disc = s.user.staffDiscipline ? ` / ${s.user.staffDiscipline}` : '';
      console.log(`  • ${s.user.givenName} ${s.user.familyName} [${s.user.primaryRole}${disc}] — ${s.class.title}`);
    }
  }
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
