import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

// Generic request validator. Replaces ad-hoc `if (!param) return res.status(400)`
// scattered across the original server.js.
export function validate<T>(
  source: 'body' | 'query' | 'params',
  schema: ZodSchema<T>,
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    // Cast to unknown to satisfy req[source] write; runtime shape matches.
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
