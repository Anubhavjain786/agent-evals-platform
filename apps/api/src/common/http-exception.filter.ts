import type { ApiErrorBody } from '@agent-evals/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Renders every error as `ApiErrorBody`; unexpected errors are logged and never leak internals. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const payload = typeof raw === 'string' ? { message: raw } : (raw as Record<string, unknown>);
      const message = Array.isArray(payload.message)
        ? payload.message.join('; ')
        : String(payload.message ?? exception.message);
      const body: ApiErrorBody = {
        statusCode: status,
        error: HttpStatus[status] ?? 'Error',
        message,
        ...(payload.details !== undefined ? { details: payload.details } : {}),
      };
      response.status(status).json(body);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const body: ApiErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
