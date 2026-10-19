import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { validateCheckin } from "@/modules/invitations/application/invitation-service";

const bodySchema = z.object({ eventId: z.string().uuid(), code: z.string().trim().min(1).max(400) });

/**
 * POST { eventId, code } → check-in result. Requires a session with
 * `event.invitations.checkin` on the event. The code is the raw token or the
 * URL embedded in the QR; nothing about the guest is in the code itself.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorOrThrow();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    const outcome = await validateCheckin(actor, parsed.data.eventId, parsed.data.code);
    return NextResponse.json(outcome, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
