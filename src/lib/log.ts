// Structured JSON logger keyed by request_id, scrubs known secret fields.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SCRUB_KEYS = new Set(['secret', 'token', 'authorization', 'password', 'access_token']);

function scrub(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SCRUB_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrub(v);
    }
  }
  return out;
}

export type LogFields = Record<string, unknown> & { event: string };

export function log(level: LogLevel, request_id: string, fields: LogFields): void {
  const entry = {
    ts: Date.now(),
    request_id,
    level,
    ...scrub(fields) as Record<string, unknown>,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
