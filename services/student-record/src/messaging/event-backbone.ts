import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryBroker, KafkaBroker, type Broker } from '@oneplatform/events';
import { Kafka, type Consumer, type Producer } from 'kafkajs';

/**
 * Selects and owns the event broker (ADR-0003). `memory` (default) uses an
 * in-process broker; `kafka` binds to Kafka/MSK via kafkajs. Lifecycle:
 *  - onModuleInit: connect the producer/consumer (so the relay can publish)
 *  - onApplicationBootstrap: after consumers have registered their handlers,
 *    subscribe the kafka consumer to those topics and start the run loop
 *  - onModuleDestroy: disconnect
 */
@Injectable()
export class EventBackbone implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EventBackbone.name);
  private readonly mode: 'memory' | 'kafka';
  private readonly broker: Broker;
  private kafkaBroker?: KafkaBroker;
  private producer?: Producer;
  private consumer?: Consumer;

  constructor(config: ConfigService) {
    this.mode = config.get<'memory' | 'kafka'>('eventBroker', 'memory');
    if (this.mode === 'kafka') {
      const brokers = config.get<string>('kafkaBrokers', 'localhost:9092').split(',');
      const kafka = new Kafka({ clientId: config.get<string>('kafkaClientId', 'student-record'), brokers });
      this.producer = kafka.producer();
      this.consumer = kafka.consumer({ groupId: config.get<string>('kafkaGroupId', 'student-record') });
      this.kafkaBroker = new KafkaBroker({
        producer: this.producer,
        topicPrefix: config.get<string>('kafkaTopicPrefix', ''),
      });
      this.broker = this.kafkaBroker;
      this.logger.log(`Event broker: kafka (${brokers.join(',')})`);
    } else {
      this.broker = new InMemoryBroker();
      this.logger.log('Event broker: in-memory');
    }
  }

  getBroker(): Broker {
    return this.broker;
  }

  async onModuleInit(): Promise<void> {
    if (this.producer) await this.producer.connect();
    if (this.consumer) await this.consumer.connect();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.consumer || !this.kafkaBroker) return;
    const topics = this.kafkaBroker.subscribedTopics();
    for (const t of topics) {
      await this.consumer.subscribe({ topic: this.kafkaBroker.kafkaTopic(t), fromBeginning: false });
    }
    const kb = this.kafkaBroker;
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (message.value) await kb.dispatch(topic, message.value.toString());
      },
    });
    this.logger.log(`Kafka consumer running on: ${topics.map((t) => kb.kafkaTopic(t)).join(', ')}`);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.producer?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      await this.consumer?.disconnect();
    } catch {
      /* ignore */
    }
  }
}
