export interface AppConfig {
  serviceName: string;
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  relayPollMs: number;
  eventBroker: 'memory' | 'kafka';
  kafkaBrokers: string;
  kafkaClientId: string;
  kafkaGroupId: string;
  kafkaTopicPrefix: string;
}

export const configuration = (): AppConfig => ({
  serviceName: process.env.SERVICE_NAME ?? 'student-record',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3002),
  databaseUrl: process.env.DATABASE_URL,
  relayPollMs: Number(process.env.RELAY_POLL_MS ?? 500),
  eventBroker: process.env.EVENT_BROKER === 'kafka' ? 'kafka' : 'memory',
  kafkaBrokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'student-record',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? 'student-record',
  kafkaTopicPrefix: process.env.KAFKA_TOPIC_PREFIX ?? '',
});
