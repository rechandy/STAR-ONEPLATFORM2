import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrgType, RoleType } from '@prisma/client';
import { AuthzService } from '../authz/authz.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateParentDto, CreateStudentDto, CreateTeacherDto } from './dto';

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Admin provisioning of roster users (teachers, students, parents). Each call
 * is authorized with Cedar `manageRoster` on the target school org before any
 * write — only admins of that school (or district admins) may provision.
 */
@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  private genId(prefix: string): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  private email(given: string, family: string, id: string): string {
    return `${slug(given)}.${slug(family)}.${id.toLowerCase()}@stardemo.org`;
  }

  private async requireSchool(tenantId: string, orgId: string) {
    const org = await this.prisma.org.findFirst({
      where: { id: orgId, tenantId, type: OrgType.SCHOOL },
    });
    if (!org) throw new BadRequestException(`School org not found: ${orgId}`);
    return org;
  }

  private async authorize(tenantId: string, staffId: string, orgId: string): Promise<void> {
    if (!(await this.authz.canManageOrg(tenantId, staffId, orgId))) {
      throw new ForbiddenException(`Not authorized to manage roster for ${orgId}.`);
    }
  }

  async createTeacher(tenantId: string, staffId: string, dto: CreateTeacherDto) {
    await this.authorize(tenantId, staffId, dto.schoolOrgId);
    await this.requireSchool(tenantId, dto.schoolOrgId);
    const id = this.genId('T');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          tenantId,
          sourcedId: id,
          username: id,
          givenName: dto.givenName,
          familyName: dto.familyName,
          email: dto.email ?? this.email(dto.givenName, dto.familyName, id),
          primaryRole: RoleType.TEACHER,
        },
      });
      await tx.orgMembership.create({
        data: { id: `om-${id}`, tenantId, userId: id, orgId: dto.schoolOrgId, role: RoleType.TEACHER, isPrimary: true },
      });
    });
    return { id, name: `${dto.givenName} ${dto.familyName}`, role: RoleType.TEACHER, schoolOrgId: dto.schoolOrgId };
  }

  async createStudent(tenantId: string, staffId: string, dto: CreateStudentDto) {
    await this.authorize(tenantId, staffId, dto.schoolOrgId);
    await this.requireSchool(tenantId, dto.schoolOrgId);
    const id = this.genId('S');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          tenantId,
          sourcedId: id,
          username: id,
          givenName: dto.givenName,
          familyName: dto.familyName,
          email: this.email(dto.givenName, dto.familyName, id),
          primaryRole: RoleType.STUDENT,
        },
      });
      await tx.orgMembership.create({
        data: { id: `om-${id}`, tenantId, userId: id, orgId: dto.schoolOrgId, role: RoleType.STUDENT, isPrimary: true },
      });
      await tx.studentProfile.create({
        data: { id: `sp-${id}`, tenantId, userId: id, grade: dto.grade, primaryDiagnosis: dto.diagnosis ?? 'Unspecified' },
      });
    });
    return { id, name: `${dto.givenName} ${dto.familyName}`, role: RoleType.STUDENT, schoolOrgId: dto.schoolOrgId };
  }

  async createParent(tenantId: string, staffId: string, dto: CreateParentDto) {
    const student = await this.prisma.user.findFirst({
      where: { id: dto.studentId, tenantId, primaryRole: RoleType.STUDENT },
      select: { id: true },
    });
    if (!student) throw new NotFoundException(`Student ${dto.studentId} not found.`);

    const membership = await this.prisma.orgMembership.findFirst({
      where: { tenantId, userId: dto.studentId, role: RoleType.STUDENT },
      select: { orgId: true },
    });
    if (!membership) throw new BadRequestException(`Student ${dto.studentId} has no school.`);

    await this.authorize(tenantId, staffId, membership.orgId);

    const id = this.genId('G');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          tenantId,
          sourcedId: id,
          username: id,
          givenName: dto.givenName,
          familyName: dto.familyName,
          email: this.email(dto.givenName, dto.familyName, id),
          primaryRole: RoleType.GUARDIAN,
        },
      });
      await tx.orgMembership.create({
        data: { id: `om-${id}`, tenantId, userId: id, orgId: membership.orgId, role: RoleType.GUARDIAN, isPrimary: true },
      });
      await tx.guardianRelationship.create({
        data: { tenantId, guardianId: id, studentId: dto.studentId, relation: dto.relation ?? 'parent' },
      });
    });
    return { id, name: `${dto.givenName} ${dto.familyName}`, role: RoleType.GUARDIAN, studentId: dto.studentId };
  }
}
