export interface AppConfig {
  serviceName: string;
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
}

export const configuration = (): AppConfig => ({
  serviceName: process.env.SERVICE_NAME ?? 'service-template',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
});
