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
 * Mirrors roster-graph's AuthzService so both services enforce identical rules.
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
