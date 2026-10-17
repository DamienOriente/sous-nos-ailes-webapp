import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { getActor } from "@/lib/session";
import { createPublicInquiry } from "@/modules/inquiries/application/inquiry-service";
import { publicInquirySchema } from "@/modules/inquiries/domain/inquiry-schema";
import { zodFieldErrors } from "@/modules/professionals/application/form-parsing";

const LIMIT = 5;
const WINDOW_SECONDS = 3600;

/** 5 inquiries per hour per IP (Redis INCR + EXPIRE). Fails open if Redis is down, logged. */
async function rateLimited(ip: string): Promise<boolean> {
  try {
    const key = `rl:inquiries:${ip}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, WINDOW_SECONDS);
    return n > LIMIT;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "inquiry rate limit unavailable");
    return false;
  }
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = await clientIp();
  if (await rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Trop de demandes envoyées depuis votre connexion. Réessayez dans une heure." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = publicInquirySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    // Honeypot filled: pretend success so bots learn nothing.
    if (fieldErrors.website) return NextResponse.json({ ok: true, id: null });
    return NextResponse.json({ ok: false, error: "Vérifiez les champs signalés.", fieldErrors }, { status: 400 });
  }
  try {
    const actor = await getActor();
    const { id } = await createPublicInquiry(parsed.data, actor);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logger.error({ err: e instanceof Error ? e.message : String(e) }, "inquiry creation failed");
    return NextResponse.json({ ok: false, error: "Impossible d'enregistrer la demande pour le moment." }, { status: 500 });
  }
}
