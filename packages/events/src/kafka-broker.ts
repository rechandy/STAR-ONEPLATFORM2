import type { Broker, EventHandler } from './broker';
import type { EventEnvelope } from './envelope';
import { topicForType } from './envelope';

/** Minimal producer contract (satisfied by a kafkajs Producer). */
export interface KafkaProducerLike {
  send(record: { topic: string; messages: { key?: string; value: string }[] }): Promise<unknown>;
}

export interface KafkaBrokerOptions {
  producer: KafkaProducerLike;
  /** Optional environment/namespace prefix for topics, e.g. "prod.". */
  topicPrefix?: string;
}

/**
 * Kafka binding of the `Broker` interface (ADR-0003). Publishing serializes the
 * envelope to a message keyed by `aggregateId` (per-aggregate ordering). The
 * actual kafkajs consumer loop is owned by the service; it calls `dispatch()`
 * for each message, which routes to the registered handlers. This class holds
 * no kafkajs import, so it is unit-testable with a fake producer.
 */
export class KafkaBroker implements Broker {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly prefix: string;

  constructor(private readonly opts: KafkaBrokerOptions) {
    this.prefix = opts.topicPrefix ?? '';
  }

  kafkaTopic(logicalTopic: string): string {
    return this.prefix + logicalTopic;
  }

  logicalTopic(kafkaTopic: string): string {
    return this.prefix && kafkaTopic.startsWith(this.prefix)
      ? kafkaTopic.slice(this.prefix.length)
      : kafkaTopic;
  }

  async publish(env: EventEnvelope): Promise<void> {
    const topic = this.kafkaTopic(topicForType(env.type));
    await this.opts.producer.send({
      topic,
      messages: [{ key: env.aggregateId, value: JSON.stringify(env) }],
    });
  }

  subscribe(topic: string, handler: EventHandler): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  /** Logical topics with at least one subscriber (the consumer subscribes to these). */
  subscribedTopics(): string[] {
    return [...this.handlers.keys()];
  }

  /** Called by the consumer loop per message; routes the parsed envelope. */
  async dispatch(kafkaTopic: string, value: string): Promise<void> {
    const set = this.handlers.get(this.logicalTopic(kafkaTopic));
    if (!set) return;
    const env = JSON.parse(value) as EventEnvelope;
    for (const handler of set) {
      await handler(env);
    }
  }
}
