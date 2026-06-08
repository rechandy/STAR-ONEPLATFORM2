/**
 * `student.metric.v1` — emitted whenever a student outcome metric is recorded.
 * Consumed by SOLER (progress monitoring), Links (adapt instruction), and
 * Reporting (lakehouse / dashboards). This is the one canonical outcome shape.
 */
export interface StudentMetricV1 {
  metricId: string;
  tenantId: string;
  studentId: string;
  goalId?: string | null;
  classId?: string | null;
  source: string;
  metricType: string;
  value: unknown;
  occurredAt: string;
  recordedById?: string | null;
  schemaVersion: number;
}

/** JSON Schema for `student.metric.v1` (validated by the registry, ajv). */
export const studentMetricV1Schema = {
  $id: 'student.metric.v1',
  type: 'object',
  required: [
    'metricId',
    'tenantId',
    'studentId',
    'source',
    'metricType',
    'value',
    'occurredAt',
    'schemaVersion',
  ],
  additionalProperties: true,
  properties: {
    metricId: { type: 'string' },
    tenantId: { type: 'string' },
    studentId: { type: 'string' },
    goalId: { type: ['string', 'null'] },
    classId: { type: ['string', 'null'] },
    source: { type: 'string' },
    metricType: { type: 'string' },
    value: {},
    occurredAt: { type: 'string', format: 'date-time' },
    recordedById: { type: ['string', 'null'] },
    schemaVersion: { type: 'integer' },
  },
} as const;
