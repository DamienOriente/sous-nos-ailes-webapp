import pino from "pino";
import { env, isProduction } from "@/lib/env";

/**
 * Structured logger. JSON in production, pretty in development.
 * Redaction removes anything that could leak a credential or personal data
 * when a request object slips into a log line.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "sous-nos-ailes" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.secret",
      "*.email",
      "*.healthNotes",
    ],
    censor: "[redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" },
        },
      }),
});

export type Logger = typeof logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
