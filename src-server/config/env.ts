import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

loadEnv();

// Centralised, validated runtime configuration. Anything that reads
// process.env outside this file is a bug - import the typed `env` object
// and let zod surface misconfiguration at boot.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().optional(),

  // Comma-separated list of allowed CORS origins.
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4173'),

  // Optional override for cache directory; defaults computed below.
  CACHE_DIR: z.string().optional(),

  // Shared secret used by Dockerfile.job to call /api/build-cache without
  // a Firebase token. If unset, the cache-build endpoint requires Firebase
  // auth (the previous behaviour).
  CACHE_BUILD_TOKEN: z.string().min(16).optional(),

  // Firebase Admin (server). Either provide explicit credentials or rely
  // on GOOGLE_APPLICATION_CREDENTIALS / Application Default Credentials.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Emit a JSON line directly to stderr. We can't use the pino logger here
  // because logger.ts imports this module, so doing so would create a
  // circular dependency at boot. Keeping the same shape Pino uses
  // (ts/level/component/msg) so log aggregators don't see two formats.
  process.stderr.write(
    JSON.stringify({
      level: 'fatal',
      ts: new Date().toISOString(),
      component: 'env',
      msg: 'invalid_environment_configuration',
      issues: parsed.error.flatten().fieldErrors,
    }) + '\n',
  );
  process.exit(1);
}

const raw = parsed.data;

const cacheDir =
  raw.CACHE_DIR ??
  (raw.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'cache'));

export const env = {
  ...raw,
  CACHE_DIR: cacheDir,
  ALLOWED_ORIGINS_LIST: raw.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  IS_PRODUCTION: raw.NODE_ENV === 'production',
  // Newlines in PRIVATE_KEY are typically escaped as \n in env files.
  FIREBASE_PRIVATE_KEY: raw.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
} as const;

export type Env = typeof env;
