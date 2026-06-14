const COLORS = { INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m', RESET: '\x1b[0m' };

function emit(level, args) {
  const ts = new Date().toISOString();
  const color = process.stdout.isTTY ? COLORS[level] : '';
  const reset = process.stdout.isTTY ? COLORS.RESET : '';
  const stream = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  stream(`[${ts}] ${color}${level}${reset}`, ...args);
}

module.exports = {
  info: (...args) => emit('INFO', args),
  warn: (...args) => emit('WARN', args),
  error: (...args) => emit('ERROR', args),
};
