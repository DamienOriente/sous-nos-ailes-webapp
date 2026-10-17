import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations } from "@/db/schema";
import { isAppError, NotFoundError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { getOrCreateCheckinQr } from "@/modules/invitations/application/invitation-service";

/**
 * Download of an invitation's check-in QR (PNG or SVG). `[token]` is the
 * invitation id; access requires a session with `event.invitations.manage`
 * on the invitation's event and the premium entitlement (checked in the service).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token: invitationId } = await params;
    if (!/^[0-9a-f-]{36}$/.test(invitationId)) throw new NotFoundError();
    const actor = await requireActorOrThrow();
    const [inv] = await db.select({ eventId: invitations.eventId }).from(invitations).where(eq(invitations.id, invitationId)).limit(1);
    if (!inv) throw new NotFoundError();
    const qr = await getOrCreateCheckinQr(actor, inv.eventId, invitationId);
    const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
    if (format === "svg") {
      return new NextResponse(qr.svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="qr-${invitationId.slice(0, 8)}.svg"` } });
    }
    const png = Buffer.from(qr.pngDataUrl.split(",")[1] ?? "", "base64");
    return new NextResponse(new Uint8Array(png), { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="qr-${invitationId.slice(0, 8)}.png"` } });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
