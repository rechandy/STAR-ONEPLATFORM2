import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityStatus, GoalDomain } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scope & sequence: active curriculum objectives (optionally one domain),
   * ordered by domain then sequence, each with its lesson count. This is the
   * teacher-facing curriculum map Links assignments are built from.
   */
  async scopeSequence(tenantId: string, domain?: string) {
    if (domain && !(Object.values(GoalDomain) as string[]).includes(domain)) {
      throw new BadRequestException(`Unknown domain: ${domain}`);
    }

    const objectives = await this.prisma.curriculumObjective.findMany({
      where: {
        tenantId,
        status: EntityStatus.ACTIVE,
        ...(domain ? { domain: domain as GoalDomain } : {}),
      },
      orderBy: [{ domain: 'asc' }, { sequence: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { lessons: true } } },
    });

    return {
      count: objectives.length,
      objectives: objectives.map((o) => ({
        id: o.id,
        domain: o.domain,
        code: o.code,
        title: o.title,
        description: o.description,
        sequence: o.sequence,
        lessonCount: o._count.lessons,
      })),
    };
  }

  /** A curriculum objective with its ordered lessons (the delivery routine). */
  async objectiveDetail(tenantId: string, objectiveId: string) {
    const objective = await this.prisma.curriculumObjective.findFirst({
      where: { id: objectiveId, tenantId },
      include: {
        lessons: {
          where: { status: EntityStatus.ACTIVE },
          orderBy: [{ sequence: 'asc' }, { code: 'asc' }],
        },
      },
    });
    if (!objective) throw new NotFoundException(`Unknown objective ${objectiveId}`);

    return {
      id: objective.id,
      domain: objective.domain,
      code: objective.code,
      title: objective.title,
      description: objective.description,
      sequence: objective.sequence,
      lessons: objective.lessons.map((l) => ({
        id: l.id,
        code: l.code,
        title: l.title,
        sequence: l.sequence,
        estimatedMinutes: l.estimatedMinutes,
        steps: l.steps,
      })),
    };
  }
}
