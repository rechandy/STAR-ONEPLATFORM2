import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import {
  can,
  type Action,
  type StaffEntityInput,
  type StudentEntityInput,
} from '@oneplatform/authz';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cedar bridge: projects staff/student into policy entities and evaluates a
 * decision. Reads the roster slice it needs directly (dev co-located DB); in
 * production this is replaced by a local roster read model fed by events.
 * Mirrors roster-graph + student-record + soler so every service enforces
 * identical rules.
 */
@Injectable()
export class AuthzService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccessStudent(
    tenantId: string,
    staffId: string,
    action: Action,
    studentId: string,
  ): Promise<boolean> {
    const [staff, student] = await Promise.all([
      this.staffEntity(tenantId, staffId),
      this.studentEntity(tenantId, studentId),
    ]);
    if (!staff || !student) return false;
    return can(staff, action, student);
  }

  /**
   * Class-scoped authority for curriculum assignment: the staff member teaches
   * the section (any non-student enrollment) or administers the school that owns
   * it. There is no class-level Cedar action, so this is enforced from roster
   * facts — consistent with how Cedar's `recordStudentData` uses shared-class.
   */
  async canAccessClass(tenantId: string, staffId: string, classId: string): Promise<boolean> {
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { tenantId, userId: staffId, classId, role: { not: RoleType.STUDENT } },
      select: { id: true },
    });
    if (enrolled) return true;

    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      select: { schoolId: true },
    });
    if (!cls) return false;

    const admin = await this.prisma.orgMembership.findFirst({
      where: {
        tenantId,
        userId: staffId,
        orgId: cls.schoolId,
        role: { in: [RoleType.ADMINISTRATOR, RoleType.DISTRICT_ADMIN] },
      },
      select: { id: true },
    });
    return !!admin;
  }

  private async staffEntity(tenantId: string, staffId: string): Promise<StaffEntityInput | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: staffId, tenantId },
      select: { primaryRole: true },
    });
    if (!user) return null;

    const [enrollments, adminOrgs] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { tenantId, userId: staffId, role: { not: RoleType.STUDENT } },
        select: { classId: true },
      }),
      this.prisma.orgMembership.findMany({
        where: {
          tenantId,
          userId: staffId,
          role: { in: [RoleType.ADMINISTRATOR, RoleType.DISTRICT_ADMIN] },
        },
        select: { orgId: true },
      }),
    ]);

    return {
      id: staffId,
      tenant: tenantId,
      role: user.primaryRole,
      classes: [...new Set(enrollments.map((e) => e.classId))],
      schools: [...new Set(adminOrgs.map((m) => m.orgId))],
    };
  }

  private async studentEntity(
    tenantId: string,
    studentId: string,
  ): Promise<StudentEntityInput | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: studentId, tenantId, primaryRole: RoleType.STUDENT },
      select: { id: true },
    });
    if (!user) return null;

    const [enrollments, membership] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { tenantId, userId: studentId, role: RoleType.STUDENT },
        select: { classId: true },
      }),
      this.prisma.orgMembership.findFirst({
        where: { tenantId, userId: studentId, role: RoleType.STUDENT },
        select: { orgId: true },
      }),
    ]);

    return {
      id: studentId,
      tenant: tenantId,
      classes: [...new Set(enrollments.map((e) => e.classId))],
      school: membership?.orgId ?? '',
    };
  }
}
