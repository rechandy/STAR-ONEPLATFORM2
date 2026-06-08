import { InMemoryBroker, type Broker } from '@oneplatform/events';

/** DI token for the event broker. */
export const EVENT_BROKER = 'EVENT_BROKER';

/**
 * Dev/test binding: an in-process broker. In production this provider is swapped
 * for a Kafka/MSK-backed broker (ADR-0003) — nothing else changes, since the
 * relay and consumers depend only on the `Broker` interface.
 */
export const brokerProvider = {
  provide: EVENT_BROKER,
  useFactory: (): Broker => new InMemoryBroker(),
};
