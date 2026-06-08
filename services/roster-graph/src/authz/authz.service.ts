import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import {
  can,
  canManageOrg,
  type Action,
  type StaffEntityInput,
  type StudentEntityInput,
} from '@oneplatform/authz';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Bridges the roster graph to the Cedar policy engine: it projects a staff
 * member and a student into the entity shapes the policies need, then evaluates
 * the decision. Class ids and org ids are used verbatim (consistent on both
 * sides); tenant is always part of the decision (default-deny across tenants).
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

  /** Org-scoped capability (admin roster management / provisioning). */
  async canManageOrg(tenantId: string, staffId: string, orgId: string): Promise<boolean> {
    const staff = await this.staffEntity(tenantId, staffId);
    if (!staff) return false;
    return canManageOrg(staff, { id: orgId, tenant: tenantId });
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
