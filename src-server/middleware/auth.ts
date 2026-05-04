import type { NextFunction, Request, Response } from 'express';
import { admin } from '../config/firebase';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { DecodedIdToken } from 'firebase-admin/auth';

declare module 'express-serve-static-core' {
  interface Request {
    user?: DecodedIdToken;
    serviceAuth?: boolean;
  }
}

const log = logger.child({ component: 'auth' });

/**
 * Verify a Firebase ID token from the Authorization: Bearer header. Optionally
 * accept a static service token (sent as `X-Cache-Build-Token`) so the cron
 * job can authenticate without a user identity.
 */
export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  // Service-token path for the cache-build cron job.
  const serviceToken = req.header('x-cache-build-token');
  if (env.CACHE_BUILD_TOKEN && serviceToken && serviceToken === env.CACHE_BUILD_TOKEN) {
    req.serviceAuth = true;
    return next();
  }

  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    return next();
  } catch (err) {
    log.error({ err }, 'auth_token_invalid');
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}
