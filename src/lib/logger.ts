// Minimal structured logger. Never pass user payloads, tokens or secrets.
type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const record = { level, event, time: new Date().toISOString(), ...fields };
  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }
  const extras = fields ? ` ${JSON.stringify(fields)}` : "";
  const line = `[${level}] ${event}${extras}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
