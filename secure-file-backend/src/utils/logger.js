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

export const logger = {
  info: (message, extra) => write("info", message, extra),
  warn: (message, extra) => write("warn", message, extra),
  error: (message, extra) => write("error", message, extra)
};