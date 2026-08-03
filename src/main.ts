import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

function resolveLoggerLevels(): LogLevel[] {
  const raw = process.env.LOG_LEVELS ?? process.env.LOG_LEVEL;
  if (!raw?.trim()) {
    return process.env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error']
      : ['log', 'warn', 'error', 'debug', 'verbose'];
  }

  const allowed: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];
  const requested = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const levels = allowed.filter((level) => requested.includes(level));

  return levels.length
    ? levels
    : ['log', 'warn', 'error', 'debug', 'verbose'];
}

async function bootstrap() {
  const loggerLevels = resolveLoggerLevels();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: loggerLevels,
  });
  const bootstrapLogger = new Logger('Bootstrap');

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestIdHeader = req.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string' && requestIdHeader.trim()
        ? requestIdHeader.trim()
        : 'n/a';
    const requestLogger = new Logger('HTTP');

    requestLogger.debug(`--> ${req.method} ${req.originalUrl} requestId=${requestId}`);
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const message = `<-- ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms requestId=${requestId}`;
      if (res.statusCode >= 500) requestLogger.error(message);
      else if (res.statusCode >= 400) requestLogger.warn(message);
      else requestLogger.log(message);
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  // Serve a small static storefront so the app has a basic browser experience.
  app.useStaticAssets(join(__dirname, 'public'));

  await app.listen(process.env.PORT ?? 3000);
  bootstrapLogger.log(
    `API listening on port ${process.env.PORT ?? 3000} with logger levels: ${loggerLevels.join(', ')}`,
  );
}
bootstrap();
