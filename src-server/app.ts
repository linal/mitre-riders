import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import racersRouter from './routes/racers.routes';
import clubsRouter from './routes/clubs.routes';
import raceDataRouter from './routes/raceData.routes';
import cacheRouter from './routes/cache.routes';

// Sensitive request bodies (e.g. /api/racers PUT) should never appear in
// logs verbatim. Pino's redaction handles that for us.
const REDACTED_PATHS = ['req.headers.authorization', 'req.headers.cookie', 'req.body.bc'];

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    // Disable CSP defaults; the SPA serves its own assets and inline
    // scripts via Vite's build output.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow same-origin and tools (no Origin header) by default.
        if (!origin) return callback(null, true);
        if (env.ALLOWED_ORIGINS_LIST.includes(origin)) return callback(null, true);
        // In dev, fall back to allowing localhost so Vite preview/proxy work.
        if (!env.IS_PRODUCTION && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.use(
    pinoHttp({
      logger,
      redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Keep noisy GETs out of access logs.
      autoLogging: {
        ignore: (req) => req.method === 'GET' && req.url?.startsWith('/static') === true,
      },
    }),
  );

  // Per-route rate limiting on the expensive endpoints. The static asset
  // path and read-only listings are deliberately not limited.
  const expensiveLimiter = rateLimit({
    windowMs: 60_000,
    max: env.IS_PRODUCTION ? 30 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const buildCacheLimiter = rateLimit({
    windowMs: 5 * 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many cache rebuild requests, please try again later.' },
  });

  app.use('/api/race-data', expensiveLimiter);
  app.use('/api/build-cache', buildCacheLimiter);

  // Static frontend (built by Vite into ./client during the docker build).
  app.use(express.static(path.join(process.cwd(), 'client')));

  // API routes.
  app.use('/api/racers', racersRouter);
  app.use('/api', clubsRouter);
  app.use('/api', raceDataRouter);
  app.use('/api', cacheRouter);

  // Health probe.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, env: env.NODE_ENV, uptime_s: Math.round(process.uptime()) });
  });

  // SPA fallback for any non-API GET.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return notFoundHandler(req, res);
    res.sendFile(path.join(process.cwd(), 'client', 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
