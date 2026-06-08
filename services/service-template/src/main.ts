import 'reflect-metadata';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks(); // graceful shutdown on SIGTERM (k8s-friendly)

  const port = config.get<number>('port', 3000);
  await app.listen(port);
  Logger.log(
    `${config.get('serviceName')} listening on :${port} (env=${config.get('nodeEnv')})`,
    'Bootstrap',
  );
}

void bootstrap();
