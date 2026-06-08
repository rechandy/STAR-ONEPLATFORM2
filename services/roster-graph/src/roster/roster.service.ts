import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ClassRef {
  id: string;
  title: string;
  focusDomain: string | null;
  discipline: string | null;
}

export interface StudentAccess {
  id: string;
  name: string;
  grade: string | null;
  diagnosis: string | null;
  viaClasses: ClassRef[];
}

export interface StaffAccess {
  id: string;
  name: string;
  role: RoleType;
  discipline: string | null;
  viaClasses: Array<{ id: string; title: string; role: RoleType }>;
}

@Injectable()
export class RosterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Classes a staff member teaches or serves (across all of their sections). */
  async myClasses(tenantId: string, staffId: string) {
    const rows = await this.prisma.enrollment.findMany({
      where: { tenantId, userId: staffId, role: { not: RoleType.STUDENT } },
      include: {
        class: {
          select: {
            id: true,
            title: true,
            classType: true,
            focusDomain: true,
            discipline: true,
            schoolId: true,
          },
        },
      },
      orderBy: { class: { title: 'asc' } },
    });
    return {
      staffId,
      classCount: rows.length,
      classes: rows.map((r) => ({ enrollmentRole: r.role, ...r.class })),
    };
  }

  /**
   * Every distinct student a staff member can access — spanning their primary
   * sections, co-taught sections, and (for specialists) caseloads. This is the
   * "my students" view every pillar relies on.
   */
  async myStudents(tenantId: string, staffId: string) {
    const classIds = await this.staffClassIds(tenantId, staffId, { not: RoleType.STUDENT });
    const students = await this.studentsInClasses(tenantId, classIds);
    return { staffId, studentCount: students.length, students };
  }

  /** A specialist's caseload — students in their related-service sections only. */
  async myCaseload(tenantId: string, staffId: string) {
    const classIds = await this.staffClassIds(tenantId, staffId, RoleType.SPECIALIST);
    const students = await this.studentsInClasses(tenantId, classIds);
    return { staffId, caseloadCount: students.length, students };
  }

  /**
   * The authorization access set: every staff member who can reach a student
   * through a shared class, and via which classes. This is exactly what the
   * permissions layer (Cedar/RBAC) must resolve — see docs/adr/0005.
   */
  async accessSet(tenantId: string, studentId: string) {
    const studentClasses = await this.prisma.enrollment.findMany({
      where: { tenantId, userId: studentId, role: RoleType.STUDENT },
      select: { classId: true },
    });
    const classIds = [...new Set(studentClasses.map((c) => c.classId))];
    if (classIds.length === 0) {
      return { studentId, staffCount: 0, staff: [] as StaffAccess[] };
    }

    const staffEnr = await this.prisma.enrollment.findMany({
      where: { tenantId, classId: { in: classIds }, role: { not: RoleType.STUDENT } },
      include: {
        user: {
          select: {
            id: true,
            givenName: true,
            familyName: true,
            primaryRole: true,
            staffDiscipline: true,
          },
        },
        class: { select: { id: true, title: true } },
      },
    });

    const byStaff = new Map<string, StaffAccess>();
    for (const e of staffEnr) {
      const existing = byStaff.get(e.user.id);
      const via = { id: e.class.id, title: e.class.title, role: e.role };
      if (existing) {
        existing.viaClasses.push(via);
      } else {
        byStaff.set(e.user.id, {
          id: e.user.id,
          name: `${e.user.givenName} ${e.user.familyName}`,
          role: e.user.primaryRole,
          discipline: e.user.staffDiscipline,
          viaClasses: [via],
        });
      }
    }
    const staff = [...byStaff.values()].sort((a, b) => a.id.localeCompare(b.id));
    return { studentId, staffCount: staff.length, staff };
  }

  // -- helpers ---------------------------------------------------------------

  private async staffClassIds(
    tenantId: string,
    staffId: string,
    role: RoleType | { not: RoleType },
  ): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { tenantId, userId: staffId, role },
      select: { classId: true },
    });
    return [...new Set(rows.map((r) => r.classId))];
  }

  private async studentsInClasses(tenantId: string, classIds: string[]): Promise<StudentAccess[]> {
    if (classIds.length === 0) return [];
    const enr = await this.prisma.enrollment.findMany({
      where: { tenantId, classId: { in: classIds }, role: RoleType.STUDENT },
      include: {
        user: {
          select: {
            id: true,
            givenName: true,
            familyName: true,
            studentProfile: { select: { grade: true, primaryDiagnosis: true } },
          },
        },
        class: { select: { id: true, title: true, focusDomain: true, discipline: true } },
      },
    });

    const byStudent = new Map<string, StudentAccess>();
    for (const e of enr) {
      const via: ClassRef = {
        id: e.class.id,
        title: e.class.title,
        focusDomain: e.class.focusDomain,
        discipline: e.class.discipline,
      };
      const existing = byStudent.get(e.user.id);
      if (existing) {
        existing.viaClasses.push(via);
      } else {
        byStudent.set(e.user.id, {
          id: e.user.id,
          name: `${e.user.givenName} ${e.user.familyName}`,
          grade: e.user.studentProfile?.grade ?? null,
          diagnosis: e.user.studentProfile?.primaryDiagnosis ?? null,
          viaClasses: [via],
        });
      }
    }
    return [...byStudent.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
