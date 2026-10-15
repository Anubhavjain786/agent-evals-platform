import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { APP_CONFIG, type AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  // Graceful shutdown: in-flight runs are interrupted and re-queued on next boot.
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  app
    .get(Logger)
    .log(
      `Agent Evals listening on http://${config.host}:${config.port} (UI ${config.webDistDir ? 'enabled' : 'not built'})`,
      'Bootstrap',
    );
}

void bootstrap();
