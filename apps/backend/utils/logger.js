const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function currentLevel() {
  return LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
}

function log(level, scope, message, meta) {
  if (LEVELS[level] > currentLevel()) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${scope}]`;
  if (meta !== undefined) {
    console[level === 'debug' ? 'log' : level](prefix, message, meta);
  } else {
    console[level === 'debug' ? 'log' : level](prefix, message);
  }
}

export function createLogger(scope) {
  return {
    error: (message, meta) => log('error', scope, message, meta),
    warn: (message, meta) => log('warn', scope, message, meta),
    info: (message, meta) => log('info', scope, message, meta),
    debug: (message, meta) => log('debug', scope, message, meta),
  };
}
