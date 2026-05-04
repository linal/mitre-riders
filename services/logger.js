// Lightweight structured JSON logger.
//
// Every log entry is emitted as a single line of JSON to stdout (info/debug)
// or stderr (warn/error), which makes it easy to parse with `jq`, ship to
// log aggregators (Fly, Datadog, Loki, CloudWatch, ...), and grep by field.
//
// Usage:
//   const { logger } = require('./logger');
//   logger.info('cache_hit', { cacheKey, source: 'memory' });
//
//   // Per-request child logger that automatically tags every message:
//   const log = logger.child({ person_id, year, discipline });
//   log.info('puppeteer_start');
//   log.error('cloudflare_persistent', { html_length: html.length });
//
// Level can be controlled with the LOG_LEVEL env var (debug|info|warn|error).
// Pretty-printed output for local development can be enabled with
// LOG_PRETTY=1 (uses 2-space indentation).

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_LEVEL = LEVELS[configuredLevel] ?? LEVELS.info;
const PRETTY = process.env.LOG_PRETTY === '1' || process.env.LOG_PRETTY === 'true';

function serializeError(err) {
  if (!err || typeof err !== 'object') return err;
  const out = {
    message: err.message,
    name: err.name,
    stack: err.stack,
  };
  if (err.code !== undefined) out.code = err.code;
  if (err.status !== undefined) out.status = err.status;
  if (err.response && typeof err.response === 'object') {
    out.response = {
      status: err.response.status,
      statusText: err.response.statusText,
    };
  }
  return out;
}

function safeStringify(entry) {
  try {
    return PRETTY ? JSON.stringify(entry, null, 2) : JSON.stringify(entry);
  } catch (e) {
    // Circular ref or BigInt, etc. Fall back to a minimal entry.
    return JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      msg: 'log_serialize_failed',
      original_msg: entry && entry.msg,
      error: e.message,
    });
  }
}

function emit(level, msg, fields) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const merged = fields ? { ...fields } : {};
  if (merged.err instanceof Error) {
    merged.err = serializeError(merged.err);
  }
  if (merged.error instanceof Error) {
    merged.error = serializeError(merged.error);
  }

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...merged,
  };

  const line = safeStringify(entry) + '\n';
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

class Logger {
  constructor(bindings = {}) {
    this.bindings = bindings;
  }

  child(extra = {}) {
    return new Logger({ ...this.bindings, ...extra });
  }

  debug(msg, fields) { emit('debug', msg, { ...this.bindings, ...fields }); }
  info(msg, fields)  { emit('info',  msg, { ...this.bindings, ...fields }); }
  warn(msg, fields)  { emit('warn',  msg, { ...this.bindings, ...fields }); }
  error(msg, fields) { emit('error', msg, { ...this.bindings, ...fields }); }
}

const logger = new Logger();

// Classify an error into a small, stable set of categories so an LLM
// reading aggregate logs can group failures without parsing stack traces.
// Add new buckets sparingly - the value is in keeping the set narrow.
function classifyError(err) {
  const message = (err && (err.message || String(err))) || '';
  if (/Cloudflare/i.test(message)) return 'cloudflare_challenge';
  if (/Browser launch/i.test(message)) return 'browser_launch_failed';
  if (/(goto|navigation|page).*timeout/i.test(message)) return 'page_navigation_timeout';
  if (/timeout/i.test(message)) return 'timeout';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return 'dns_failure';
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|EPIPE|socket hang up/i.test(message)) return 'network_error';
  if (/403|Forbidden/i.test(message)) return 'http_forbidden';
  if (/500/.test(message)) return 'http_500';
  if (/blocked|Just a moment/i.test(message)) return 'request_blocked';
  if (/ENOSPC|EACCES|EPERM|EROFS/i.test(message)) return 'storage_error';
  return 'unknown';
}

// Short collision-resistant id for correlating a batch of related log
// lines (one cache rebuild, one HTTP request, etc.).
function randomId(prefix = '') {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${ts}${rnd}` : `${ts}${rnd}`;
}

module.exports = { logger, Logger, LEVELS, classifyError, randomId };
