import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { renderInvitationPdf } from "@/modules/invitations/application/invitation-pdf";
import { getInvitationDetail, getOrCreateCheckinQr } from "@/modules/invitations/application/invitation-service";

/** A5 PDF of the invitation card; includes the QR only when premium and already generated. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; invitationId: string }> }) {
  try {
    const { id, invitationId } = await params;
    const actor = await requireActorOrThrow();
    const detail = await getInvitationDetail(actor, id, invitationId);
    let qr: string | null = null;
    if (detail.entitlement.premium && detail.hasCheckinToken && detail.invitation.status !== "revoked" && detail.invitation.status !== "expired") {
      qr = (await getOrCreateCheckinQr(actor, id, invitationId)).pngDataUrl;
    }
    const pdf = await renderInvitationPdf(detail, qr);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="invitation-${invitationId.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
