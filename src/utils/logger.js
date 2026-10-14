const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const { logs } = require('../observability/metrics');
const storage = new AsyncLocalStorage();
const SENSITIVE =
  /token|password|secret|authorization|cookie|database_url|streamurl|encoded|api.?key|credential/i;
function redactString(value) {
  let text = value;
  for (const [name, secret] of Object.entries(process.env)) {
    if (SENSITIVE.test(name) && secret.length >= 8) text = text.split(secret).join('[REDACTED]');
  }
  return text
    .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s<>"']+/gi, '[URL REDACTED]')
    .replace(
      /\b(?:(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+|Bot\s+[A-Za-z0-9._~+/=-]{20,})/g,
      '[AUTH REDACTED]',
    )
    .slice(0, 2000);
}
function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'bigint') return String(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 4 || seen.has(value)) return '[truncated]';
  seen.add(value);
  if (value instanceof Error)
    return {
      name: value.name,
      message: redactString(value.message),
      stack: redactString(value.stack || ''),
    };
  if (Array.isArray(value)) return value.slice(0, 15).map((v) => sanitize(v, depth + 1, seen));
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([k, v]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : sanitize(v, depth + 1, seen)]),
  );
}
function emit(level, args) {
  logs.inc({ level });
  const record = {
    timestamp: new Date().toISOString(),
    service: 'viordles',
    level,
    ...storage.getStore(),
    message: sanitize(args[0]),
    details: sanitize(args.slice(1)),
  };
  let line = JSON.stringify(record);
  if (Buffer.byteLength(line) > 8000)
    line = JSON.stringify({
      timestamp: record.timestamp,
      service: 'viordles',
      level,
      requestId: record.requestId,
      message: String(record.message).slice(0, 500),
      truncated: true,
    });
  (level === 'error' ? console.error : console.log)(line);
}
module.exports = {
  info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
  context: () => storage.getStore() || {},
  withContext: (fields, fn) => storage.run(fields, fn),
  request: (fn) => storage.run({ requestId: randomUUID() }, fn),
  sanitize,
};
