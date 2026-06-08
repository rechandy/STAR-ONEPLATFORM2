import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_TYPES,
  InMemoryBroker,
  idempotent,
  topicForType,
  validateEnvelope,
  validatePayload,
  type EventEnvelope,
  type StudentMetricV1,
} from '../src/index';

const goodPayload: StudentMetricV1 = {
  metricId: 'me-1',
  tenantId: 'star-demo',
  studentId: 'S00001',
  goalId: 'G00001',
  classId: 'class-T0026-comm',
  source: 'SOLER',
  metricType: 'TRIAL_SCORE',
  value: { trials: 10, correct: 9 },
  occurredAt: '2026-06-08T14:03:00.000Z',
  recordedById: 'T0026',
  schemaVersion: 1,
};

const envelope = (payload: unknown): EventEnvelope => ({
  id: 'evt-1',
  type: EVENT_TYPES.STUDENT_METRIC_V1,
  tenantId: 'star-demo',
  aggregateType: 'MetricEvent',
  aggregateId: 'me-1',
  occurredAt: '2026-06-08T14:03:00.000Z',
  schemaVersion: 1,
  payload,
});

describe('contracts', () => {
  it('topicForType strips the version', () => {
    assert.equal(topicForType('student.metric.v1'), 'student.metric');
  });

  it('validates a good student.metric.v1 payload', () => {
    const r = validatePayload(EVENT_TYPES.STUDENT_METRIC_V1, goodPayload);
    assert.equal(r.valid, true, r.errors.join('; '));
  });

  it('rejects a payload missing required fields', () => {
    const r = validatePayload(EVENT_TYPES.STUDENT_METRIC_V1, { metricId: 'x' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.length > 0);
  });

  it('rejects an unknown event type', () => {
    assert.equal(validatePayload('nope.v1', {}).valid, false);
  });

  it('validates a full envelope', () => {
    assert.equal(validateEnvelope(envelope(goodPayload)).valid, true);
  });

  it('fails envelope validation when a field is missing', () => {
    const env = envelope(goodPayload);
    // @ts-expect-error intentionally remove a required field
    delete env.tenantId;
    assert.equal(validateEnvelope(env).valid, false);
  });
});

describe('broker', () => {
  it('delivers published events to topic subscribers', async () => {
    const broker = new InMemoryBroker();
    const received: string[] = [];
    broker.subscribe('student.metric', (env) => {
      received.push(env.id);
    });
    await broker.publish(envelope(goodPayload));
    assert.deepEqual(received, ['evt-1']);
  });

  it('does not deliver to other topics', async () => {
    const broker = new InMemoryBroker();
    let count = 0;
    broker.subscribe('other.topic', () => {
      count++;
    });
    await broker.publish(envelope(goodPayload));
    assert.equal(count, 0);
  });

  it('idempotent() processes each event id once', async () => {
    let count = 0;
    const handler = idempotent(() => {
      count++;
    });
    const env = envelope(goodPayload);
    await handler(env);
    await handler(env);
    assert.equal(count, 1);
  });
});
