import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvitationCard } from "@/components/invitations/invitation-card";
import { PrintButton } from "@/components/invitations/print-button";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { getInvitationDetail, getOrCreateCheckinQr } from "@/modules/invitations/application/invitation-service";

/** Print view: card only (CSS print hides the chrome), with the QR when premium and already generated. */
export default async function InvitationPreviewPage({ params }: { params: Promise<{ id: string; invitationId: string }> }) {
  const { id, invitationId } = await params;
  const actor = await requireActor(`/app/evenements/${id}/invitations/${invitationId}/apercu`);
  let detail;
  try {
    detail = await getInvitationDetail(actor, id, invitationId);
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  const { invitation, event } = detail;
  let qr: string | null = null;
  if (detail.entitlement.premium && detail.hasCheckinToken && invitation.status !== "revoked" && invitation.status !== "expired") {
    qr = (await getOrCreateCheckinQr(actor, id, invitationId)).pngDataUrl;
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/app/evenements/${id}/invitations/${invitationId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Retour</Link>
        <PrintButton />
      </div>
      <div className="print:fixed print:inset-0 print:flex print:items-center print:justify-center">
        <InvitationCard
          className="print:h-[148mm] print:w-[105mm] print:aspect-auto"
          data={{ templateKey: invitation.templateKey, recipientName: invitation.recipientName, customMessage: invitation.customMessage, eventName: event.name, eventType: event.type, eventDate: event.eventDate, startsAt: event.startsAt, timezone: event.timezone, venueName: event.venueName, city: event.city, showDate: invitation.displayOptions.showDate, showVenue: invitation.displayOptions.showVenue }}
          qrDataUrl={qr}
        />
      </div>
    </div>
  );
}
