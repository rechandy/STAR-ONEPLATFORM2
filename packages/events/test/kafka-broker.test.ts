import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_TYPES,
  KafkaBroker,
  type EventEnvelope,
  type KafkaProducerLike,
} from '../src/index';

const env: EventEnvelope = {
  id: 'evt-1',
  type: EVENT_TYPES.STUDENT_METRIC_V1,
  tenantId: 'star-demo',
  aggregateType: 'MetricEvent',
  aggregateId: 'me-1',
  occurredAt: '2026-06-08T14:03:00.000Z',
  schemaVersion: 1,
  payload: { metricId: 'me-1', studentId: 'S00001' },
};

class FakeProducer implements KafkaProducerLike {
  sent: { topic: string; messages: { key?: string; value: string }[] }[] = [];
  async send(record: { topic: string; messages: { key?: string; value: string }[] }) {
    this.sent.push(record);
    return {};
  }
}

describe('KafkaBroker', () => {
  it('publishes to the version-stripped topic keyed by aggregateId', async () => {
    const producer = new FakeProducer();
    const broker = new KafkaBroker({ producer });
    await broker.publish(env);
    assert.equal(producer.sent.length, 1);
    assert.equal(producer.sent[0].topic, 'student.metric');
    assert.equal(producer.sent[0].messages[0].key, 'me-1');
    assert.deepEqual(JSON.parse(producer.sent[0].messages[0].value), env);
  });

  it('applies a topic prefix on publish and strips it on dispatch', async () => {
    const producer = new FakeProducer();
    const broker = new KafkaBroker({ producer, topicPrefix: 'prod.' });
    await broker.publish(env);
    assert.equal(producer.sent[0].topic, 'prod.student.metric');

    const received: string[] = [];
    broker.subscribe('student.metric', (e) => {
      received.push(e.id);
    });
    // consumer delivers the prefixed kafka topic; broker maps back to logical
    await broker.dispatch('prod.student.metric', JSON.stringify(env));
    assert.deepEqual(received, ['evt-1']);
  });

  it('dispatch routes only to matching subscribers', async () => {
    const broker = new KafkaBroker({ producer: new FakeProducer() });
    let hit = 0;
    broker.subscribe('student.metric', () => {
      hit++;
    });
    await broker.dispatch('other.topic', JSON.stringify(env));
    assert.equal(hit, 0);
    await broker.dispatch('student.metric', JSON.stringify(env));
    assert.equal(hit, 1);
  });

  it('reports subscribed topics for the consumer to subscribe to', () => {
    const broker = new KafkaBroker({ producer: new FakeProducer() });
    broker.subscribe('student.metric', () => {});
    assert.deepEqual(broker.subscribedTopics(), ['student.metric']);
  });
});
