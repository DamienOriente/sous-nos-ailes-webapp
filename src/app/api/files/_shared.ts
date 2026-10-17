import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** Maps service errors to JSON responses. Unknown errors are logged, never leaked. */
export function errorResponse(err: unknown): NextResponse {
  if (isAppError(err)) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
  }
  logger.error({ err }, "files route failure");
  return NextResponse.json({ error: "Une erreur inattendue est survenue.", code: "internal" }, { status: 500, headers: NO_STORE });
}

export function requestMeta(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const fwd = request.headers.get("x-forwarded-for");
  const ipAddress = fwd ? (fwd.split(",")[0]?.trim() ?? null) : (request.headers.get("x-real-ip") ?? null);
  return { ipAddress: ipAddress && /^[0-9a-f.:]+$/i.test(ipAddress) ? ipAddress : null, userAgent: request.headers.get("user-agent") };
}
