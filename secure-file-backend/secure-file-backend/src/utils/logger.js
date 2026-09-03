function write(level, message, extra = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...extra
  };
  const output = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    console.error(output);
  } else {
    console.log(output);
  }
}

// Child logger with bound context (e.g., requestId, userId)
export function createLogger(context = {}) {
  const bound = (level, message, extra = {}) => {
    write(level, message, { ...context, ...extra });
  };

  return {
    info: (message, extra) => bound("info", message, extra),
    warn: (message, extra) => bound("warn", message, extra),
    error: (message, extra) => bound("error", message, extra),
    child: (additionalContext) => createLogger({ ...context, ...additionalContext }),
  };
}

export const logger = createLogger();