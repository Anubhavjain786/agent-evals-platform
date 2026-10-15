import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DefinitionsModule } from './definitions/definitions.module';
import { EventsModule } from './events/events.module';
import { ExecutionModule } from './execution/execution.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          transport:
            config.env === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Streams are long-lived and health checks are noise.
          autoLogging: {
            ignore: (req) => req.url?.includes('/stream') === true || req.url === '/api/health',
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    ServeStaticModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.webDistDir ? [{ rootPath: config.webDistDir, exclude: ['/api/{*path}'] }] : [],
    }),
    DatabaseModule,
    EventsModule,
    DefinitionsModule,
    ExperimentsModule,
    ExecutionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
