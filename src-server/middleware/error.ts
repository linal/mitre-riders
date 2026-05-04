import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger, classifyError } from '../config/logger';

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
}

// Express recognises a 4-arg function as the error handler. Keep the
// signature even though we don't currently use `next`.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const log = logger.child({ component: 'error_handler', method: req.method, path: req.originalUrl });

  if (err instanceof ZodError) {
    log.warn({ issues: err.issues }, 'validation_failed');
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues,
    });
  }

  if (err instanceof HttpError) {
    log.warn({ status: err.status, msg: err.message, details: err.details }, 'http_error');
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  const error = err instanceof Error ? err : new Error(String(err));
  log.error({ err: error, error_class: classifyError(error) }, 'unhandled_error');
  res.status(500).json({ error: 'Internal Server Error' });
}
