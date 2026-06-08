/** The canonical event envelope every OnePlatform domain event is wrapped in. */
export interface EventEnvelope<T = unknown> {
  /** Globally unique event id (== outbox row id). Used for consumer dedupe. */
  id: string;
  /** Versioned event type, e.g. "student.metric.v1". */
  type: string;
  tenantId: string;
  /** Source aggregate, e.g. "MetricEvent". */
  aggregateType: string;
  aggregateId: string;
  /** ISO-8601 time the change occurred. */
  occurredAt: string;
  schemaVersion: number;
  payload: T;
}

export const EVENT_TYPES = {
  STUDENT_METRIC_V1: 'student.metric.v1',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Topic a type publishes to (version stripped): "student.metric.v1" ->
 * "student.metric". Consumers subscribe by topic and tolerate new minor
 * schema versions. Maps to a Kafka topic in production (ADR-0003).
 */
export function topicForType(type: string): string {
  return type.replace(/\.v\d+$/, '');
}
