import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { AuthzService } from '../authz/authz.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAssignmentDto } from './dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  /**
   * Assign a curriculum objective to a class or a student. Authorization:
   *  - student target -> Cedar `recordStudentData` (instructional authority)
   *  - class target   -> teaches the section / administers its school
   * Idempotent on (tenant, objective, class, student): re-assigning is an upsert.
   */
  async create(tenantId: string, staffId: string, dto: CreateAssignmentDto) {
    const toClass = !!dto.classId;
    const toStudent = !!dto.studentId;
    if (toClass === toStudent) {
      throw new BadRequestException('Provide exactly one of classId or studentId.');
    }

    const objective = await this.prisma.curriculumObjective.findFirst({
      where: { id: dto.objectiveId, tenantId },
      select: { id: true },
    });
    if (!objective) throw new NotFoundException(`Unknown objective ${dto.objectiveId}`);

    if (dto.lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: dto.lessonId, tenantId, objectiveId: dto.objectiveId },
        select: { id: true },
      });
      if (!lesson) {
        throw new BadRequestException(`Lesson ${dto.lessonId} does not belong to objective ${dto.objectiveId}`);
      }
    }

    if (toStudent) {
      const allowed = await this.authz.canAccessStudent(
        tenantId,
        staffId,
        'recordStudentData',
        dto.studentId!,
      );
      if (!allowed) throw new ForbiddenException(`Not authorized to assign curriculum to ${dto.studentId}.`);
    } else {
      const allowed = await this.authz.canAccessClass(tenantId, staffId, dto.classId!);
      if (!allowed) throw new ForbiddenException(`Not authorized to assign curriculum to class ${dto.classId}.`);
    }

    // Idempotent assign: nullable target columns make the compound unique awkward
    // to use directly, so find-then-create/update on the (objective, target) pair.
    const existing = await this.prisma.curriculumAssignment.findFirst({
      where: {
        tenantId,
        objectiveId: dto.objectiveId,
        classId: dto.classId ?? null,
        studentId: dto.studentId ?? null,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.curriculumAssignment.update({
        where: { id: existing.id },
        data: { lessonId: dto.lessonId ?? null, assignedById: staffId },
      });
    }

    return this.prisma.curriculumAssignment.create({
      data: {
        tenantId,
        objectiveId: dto.objectiveId,
        lessonId: dto.lessonId ?? null,
        classId: dto.classId ?? null,
        studentId: dto.studentId ?? null,
        assignedById: staffId,
      },
    });
  }

  /**
   * A student's curriculum: direct (student-targeted) assignments PLUS the
   * assignments made to any class the student is enrolled in.
   */
  async listByStudent(tenantId: string, studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId, userId: studentId, role: RoleType.STUDENT },
      select: { classId: true },
    });
    const classIds = [...new Set(enrollments.map((e) => e.classId))];

    const rows = await this.prisma.curriculumAssignment.findMany({
      where: {
        tenantId,
        OR: [{ studentId }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
      },
      include: { objective: { select: { domain: true, code: true, title: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return { studentId, count: rows.length, assignments: rows.map((r) => this.view(r)) };
  }

  /** All curriculum assigned to a class. */
  async listByClass(tenantId: string, staffId: string, classId: string) {
    if (!(await this.authz.canAccessClass(tenantId, staffId, classId))) {
      throw new ForbiddenException(`Not authorized to view class ${classId}.`);
    }
    const rows = await this.prisma.curriculumAssignment.findMany({
      where: { tenantId, classId },
      include: { objective: { select: { domain: true, code: true, title: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return { classId, count: rows.length, assignments: rows.map((r) => this.view(r)) };
  }

  private view(r: Prisma.CurriculumAssignmentGetPayload<{
    include: { objective: { select: { domain: true; code: true; title: true } } };
  }>) {
    return {
      id: r.id,
      objectiveId: r.objectiveId,
      objective: r.objective,
      lessonId: r.lessonId,
      classId: r.classId,
      studentId: r.studentId,
      status: r.status,
      lastAccuracy: r.lastAccuracy,
      masteredAt: r.masteredAt,
      updatedAt: r.updatedAt,
    };
  }
}
