// Browser-side structured logger. Mirrors the shape Pino uses on the server
// (ts/level/component/msg + arbitrary fields) so logs collected from the
// browser via Sentry / Datadog RUM / a custom endpoint are interchangeable
// with server logs. We deliberately go through `console.*` so DevTools can
// still expand the object inline, but the *value* logged is always a single
// JSON-shaped record - never a mix of free-form strings and objects.

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

function serializeError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

function emit(level: Level, msg: string, fields: LogFields, bindings: LogFields): void {
  const merged: LogFields = { ...bindings, ...fields };
  if (merged.err !== undefined) merged.err = serializeError(merged.err);
  if (merged.error !== undefined) merged.error = serializeError(merged.error);

  const entry = {
    ts: new Date().toISOString(),
    level,
    component: 'client',
    msg,
    ...merged,
  };

  // Use the matching console method so DevTools log filtering still works.
  // The argument is always a single object - never a printf-style string -
  // so the rendered output is structured rather than ad-hoc.
  switch (level) {
    case 'error':
      console.error(entry);
      break;
    case 'warn':
      console.warn(entry);
      break;
    case 'info':
      console.info(entry);
      break;
    case 'debug':
      console.debug(entry);
      break;
  }
}

class BrowserLogger {
  private bindings: LogFields;

  constructor(bindings: LogFields = {}) {
    this.bindings = bindings;
  }

  child(extra: LogFields): BrowserLogger {
    return new BrowserLogger({ ...this.bindings, ...extra });
  }

  debug(msg: string, fields: LogFields = {}): void {
    emit('debug', msg, fields, this.bindings);
  }

  info(msg: string, fields: LogFields = {}): void {
    emit('info', msg, fields, this.bindings);
  }

  warn(msg: string, fields: LogFields = {}): void {
    emit('warn', msg, fields, this.bindings);
  }

  error(msg: string, fields: LogFields = {}): void {
    emit('error', msg, fields, this.bindings);
  }
}

export const logger = new BrowserLogger();
export type { BrowserLogger };
