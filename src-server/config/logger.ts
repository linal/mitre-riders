import pino, { type Logger } from 'pino';
import { env } from './env';

// Single Pino instance for the whole server. Always emits JSON to stdout so
// every log line is machine-parseable by aggregators (Fly, Datadog, Loki,
// jq, ...). Pretty-printing is strictly opt-in via LOG_PRETTY=1, never
// auto-enabled, so dev and prod environments produce identical formats.
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { component: 'server' },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`,
  ...(env.LOG_PRETTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

// Classify an error into a small, stable set of categories so logs can be
// grouped without parsing stack traces.
export function classifyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (/Cloudflare/i.test(message)) return 'cloudflare_challenge';
  if (/Browser launch/i.test(message)) return 'browser_launch_failed';
  if (/(goto|navigation|page).*timeout/i.test(message)) return 'page_navigation_timeout';
  if (/timeout/i.test(message)) return 'timeout';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return 'dns_failure';
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|EPIPE|socket hang up/i.test(message))
    return 'network_error';
  if (/403|Forbidden/i.test(message)) return 'http_forbidden';
  if (/500/.test(message)) return 'http_500';
  if (/blocked|Just a moment/i.test(message)) return 'request_blocked';
  if (/ENOSPC|EACCES|EPERM|EROFS/i.test(message)) return 'storage_error';
  return 'unknown';
}

export function randomId(prefix = ''): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${ts}${rnd}` : `${ts}${rnd}`;
}
