import type { EventEnvelope } from './envelope';
import { topicForType } from './envelope';

export type EventHandler = (env: EventEnvelope) => Promise<void> | void;

/**
 * The event backbone abstraction. `InMemoryBroker` backs dev/tests; the
 * production binding is Kafka/MSK (ADR-0003) — the relay and consumers depend
 * only on this interface.
 */
export interface Broker {
  publish(env: EventEnvelope): Promise<void>;
  /** Subscribe to a topic (e.g. "student.metric"); returns an unsubscribe fn. */
  subscribe(topic: string, handler: EventHandler): () => void;
}

/** In-process broker: synchronous fan-out to subscribers of the event's topic. */
export class InMemoryBroker implements Broker {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  async publish(env: EventEnvelope): Promise<void> {
    const topic = topicForType(env.type);
    const set = this.handlers.get(topic);
    if (!set) return;
    for (const handler of set) {
      await handler(env);
    }
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
}

/**
 * Wrap a handler so each event id is processed at most once (at-least-once
 * delivery safety). In production consumers persist their dedupe set; this
 * in-memory version suffices for in-process dev/tests.
 */
export function idempotent(handler: EventHandler): EventHandler {
  const seen = new Set<string>();
  return async (env) => {
    if (seen.has(env.id)) return;
    seen.add(env.id);
    await handler(env);
  };
}
