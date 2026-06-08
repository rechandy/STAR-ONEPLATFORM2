import { BadRequestException, Injectable } from '@nestjs/common';
import { MetricType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  type OutcomeCategory,
  RECORDABLE_TYPES,
  TYPES_BY_CATEGORY,
  categoryOf,
} from './taxonomy';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const encodeCursor = (id: string) => Buffer.from(id).toString('base64url');
const decodeCursor = (c: string) => Buffer.from(c, 'base64url').toString('utf8');

export interface ListOptions {
  category?: string;
  type?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class OutcomesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reverse-chronological, cursor-paginated outcome log for a student. */
  async list(tenantId: string, studentId: string, opts: ListOptions) {
    let types: MetricType[] = RECORDABLE_TYPES;
    if (opts.category) {
      if (!(opts.category in TYPES_BY_CATEGORY)) {
        throw new BadRequestException(`Unknown category: ${opts.category}`);
      }
      types = TYPES_BY_CATEGORY[opts.category as OutcomeCategory];
    }
    if (opts.type) {
      if (!RECORDABLE_TYPES.includes(opts.type as MetricType)) {
        throw new BadRequestException(`Unknown type: ${opts.type}`);
      }
      types = [opts.type as MetricType];
    }

    const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const rows = await this.prisma.metricEvent.findMany({
      where: { tenantId, studentId, metricType: { in: types } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: decodeCursor(opts.cursor) }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      studentId,
      count: page.length,
      outcomes: page.map((e) => ({
        id: e.id,
        category: categoryOf(e.metricType),
        metricType: e.metricType,
        value: e.value,
        occurredAt: e.occurredAt,
        goalId: e.goalId,
        classId: e.classId,
        recordedById: e.recordedById,
      })),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1].id) : null,
    };
  }

  /** Aggregated progress snapshot across the four outcome families. */
  async summary(tenantId: string, studentId: string) {
    const grouped = await this.prisma.metricEvent.groupBy({
      by: ['metricType'],
      where: { tenantId, studentId, metricType: { in: RECORDABLE_TYPES } },
      _count: { _all: true },
    });

    const countByType = new Map<MetricType, number>();
    for (const g of grouped) countByType.set(g.metricType, g._count._all);
    const sum = (...types: MetricType[]) =>
      types.reduce((acc, t) => acc + (countByType.get(t) ?? 0), 0);

    const byCategory: Record<OutcomeCategory, number> = {
      progress: 0,
      milestone: 0,
      assessment: 0,
      behavior: 0,
    };
    for (const [type, c] of countByType) {
      const cat = categoryOf(type);
      if (cat) byCategory[cat] += c;
    }

    const lastAssessment = await this.prisma.metricEvent.findFirst({
      where: { tenantId, studentId, metricType: MetricType.ASSESSMENT_SCORED },
      orderBy: { occurredAt: 'desc' },
      select: { value: true, occurredAt: true },
    });

    return {
      studentId,
      totalOutcomes: [...countByType.values()].reduce((a, b) => a + b, 0),
      byCategory,
      milestonesAchieved: sum(MetricType.MILESTONE_ACHIEVED, MetricType.OBJECTIVE_MASTERED),
      behaviorIncidents: sum(MetricType.BEHAVIOR_INCIDENT),
      assessmentsLogged: sum(MetricType.ASSESSMENT_SCORED),
      progressEvents: byCategory.progress,
      lastAssessment: lastAssessment
        ? { value: lastAssessment.value, occurredAt: lastAssessment.occurredAt }
        : null,
    };
  }
}
