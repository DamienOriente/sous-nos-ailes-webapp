import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Paywall } from "@/components/billing/paywall";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { InvitationActions } from "@/components/invitations/invitation-actions";
import { InvitationCard } from "@/components/invitations/invitation-card";
import { QrPanel } from "@/components/invitations/qr-panel";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { RSVP_LABELS, RSVP_TONES, type RsvpStatus } from "@/modules/guests/domain/guests";
import { INVITATION_KIND_LABELS, INVITATION_STATUS_LABELS, INVITATION_STATUS_TONES, type InvitationKind } from "@/modules/invitations/domain/state";
import { CHECKIN_RESULT_LABELS } from "@/modules/invitations/domain/tokens";
import { getInvitationDetail } from "@/modules/invitations/application/invitation-service";
import { deleteInvitationAction, generateQrAction, getRsvpLinkAction, remindInvitationAction, revokeInvitationAction, sendInvitationAction } from "../actions";

export default async function InvitationDetailPage({ params }: { params: Promise<{ id: string; invitationId: string }> }) {
  const { id, invitationId } = await params;
  const actor = await requireActor(`/app/evenements/${id}/invitations/${invitationId}`);
  let detail;
  try {
    detail = await getInvitationDetail(actor, id, invitationId);
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  const { invitation, event, guests, responses, checkins, entitlement } = detail;
  const dateTime = (d: Date) => formatDateFr(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="space-y-6">
      <Link href={`/app/evenements/${id}/invitations`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Invitations</Link>
      <PageHeader
        title={invitation.recipientName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={INVITATION_STATUS_TONES[invitation.status]}>{INVITATION_STATUS_LABELS[invitation.status]}</StatusBadge>
            <span>
              {INVITATION_KIND_LABELS[invitation.kind as InvitationKind] ?? invitation.kind} · {guests.length} invité{guests.length > 1 ? "s" : ""}
            </span>
            {invitation.recipientEmail && <span>{invitation.recipientEmail}</span>}
            {invitation.expiresAt && <span className="text-xs">Lien valable jusqu'au {formatDateFr(invitation.expiresAt)}</span>}
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/evenements/${id}/invitations/${invitationId}/apercu`}>
                 Aperçu imprimable
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/events/${id}/invitations/${invitationId}/pdf`}>
                 PDF
              </a>
            </Button>
          </>
        }
      />
      <InvitationActions eventId={id} invitationId={invitationId} status={invitation.status} hasEmail={Boolean(invitation.recipientEmail)} reminderCount={invitation.reminderCount} onSend={sendInvitationAction} onRemind={remindInvitationAction} onRevoke={revokeInvitationAction} onDelete={deleteInvitationAction} onCopyLink={getRsvpLinkAction} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invités couverts</CardTitle>
            </CardHeader>
            <CardContent>
              {guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Invitation nominative sans invité rattaché.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {guests.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {`${g.firstName} ${g.lastName}`.trim()}
                        {g.isChild && <span className="ml-1 text-xs text-muted-foreground">(enfant)</span>}
                        {g.plusOnesAllowed > 0 && <span className="ml-1 text-xs text-muted-foreground">+{g.plusOnesAllowed} autorisé(s)</span>}
                      </span>
                      <StatusBadge tone={RSVP_TONES[g.rsvpStatus as RsvpStatus]}>{RSVP_LABELS[g.rsvpStatus as RsvpStatus]}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Réponses ({responses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune réponse pour l'instant.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {responses.map((r) => (
                    <li key={r.id} className="space-y-1 py-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={RSVP_TONES[r.status as RsvpStatus]}>{RSVP_LABELS[r.status as RsvpStatus]}</StatusBadge>
                        <span>{r.guestsCount} personne(s)</span>
                        <span className="ml-auto text-xs text-muted-foreground">{dateTime(r.createdAt)}</span>
                      </div>
                      {r.message && <p className="text-muted-foreground italic">« {r.message} »</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contrôles d'accès ({checkins.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {checkins.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun passage enregistré.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {checkins.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <span>{CHECKIN_RESULT_LABELS[c.result]}</span>
                      <span className="text-xs text-muted-foreground">{dateTime(c.scannedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <InvitationCard data={{ templateKey: invitation.templateKey, recipientName: invitation.recipientName, customMessage: invitation.customMessage, eventName: event.name, eventType: event.type, eventDate: event.eventDate, startsAt: event.startsAt, timezone: event.timezone, venueName: event.venueName, city: event.city, showDate: invitation.displayOptions.showDate, showVenue: invitation.displayOptions.showVenue }} />
          {entitlement.premium ? (
            <QrPanel eventId={id} invitationId={invitationId} hasToken={detail.hasCheckinToken} disabled={invitation.status === "revoked" || invitation.status === "expired"} onGenerate={generateQrAction} />
          ) : (
            <Paywall feature="invitations.premium" audience="organizer" title="QR code d'accès" description="Générez un QR code anonyme à usage unique par invitation et contrôlez les entrées le jour J depuis un téléphone." backHref={`/app/evenements/${id}/invitations`} />
          )}
        </div>
      </div>
    </div>
  );
}
