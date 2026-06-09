import type { Broker } from '@oneplatform/events';
import { EventBackbone } from './event-backbone';

/** DI token for the event broker. */
export const EVENT_BROKER = 'EVENT_BROKER';

/**
 * Resolves the active broker from the EventBackbone (in-memory in dev, Kafka in
 * prod). Consumers depend only on the `Broker` interface.
 */
export const brokerProvider = {
  provide: EVENT_BROKER,
  useFactory: (backbone: EventBackbone): Broker => backbone.getBroker(),
  inject: [EventBackbone],
};
