import type { Metadata } from "next";
import { Container } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { InvitationCard } from "@/components/invitations/invitation-card";
import { RsvpForm } from "@/components/invitations/rsvp-form";
import { resolvePublicInvitation } from "@/modules/invitations/application/invitation-service";
import { submitRsvpAction } from "./actions";

/** Public RSVP page: never indexed, no account required, token is the only credential. */
export const metadata: Metadata = { title: "Votre invitation", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

export default async function PublicInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await resolvePublicInvitation(token);

  if (view.outcome === "invalid" || !view.invitation || !view.event) {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState title="Invitation introuvable" description="Ce lien n'est pas valide. Vérifiez qu'il est complet ou contactez la personne qui vous a invité(e)." />
      </Container>
    );
  }
  if (view.outcome === "revoked") {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState title="Invitation annulée" description="Cette invitation a été annulée par l'organisateur. Rapprochez-vous de lui si vous pensez qu'il s'agit d'une erreur." />
      </Container>
    );
  }
  if (view.outcome === "expired" || view.outcome === "duplicate") {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState title="Invitation expirée" description="La période de réponse est terminée. Contactez directement l'organisateur." />
      </Container>
    );
  }

  const inv = view.invitation;
  const ev = view.event;
  return (
    <Container size="default" className="py-10 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[380px_1fr] lg:items-start">
        <InvitationCard data={{ templateKey: inv.templateKey, recipientName: inv.recipientName, customMessage: inv.customMessage, eventName: ev.name, eventType: ev.type, eventDate: ev.eventDate, startsAt: ev.startsAt, timezone: ev.timezone, venueName: ev.venueName, city: ev.city, showDate: inv.displayOptions.showDate, showVenue: inv.displayOptions.showVenue }} />
        <section aria-labelledby="rsvp-title" className="space-y-6">
          <div>
            <h1 id="rsvp-title" className="font-heading text-2xl font-semibold sm:text-3xl">
              Serez-vous des nôtres ?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Aucun compte n'est nécessaire. {view.lastResponse ? "Vous avez déjà répondu : vous pouvez modifier votre réponse." : ""}</p>
          </div>
          <RsvpForm token={token} guests={view.guests} previous={view.lastResponse} onSubmit={submitRsvpAction} />
          <p className="text-xs text-muted-foreground">Vos réponses sont transmises uniquement à l'organisateur de l'évènement. Sous Nos Ailes ne les utilise pas à d'autres fins.</p>
        </section>
      </div>
    </Container>
  );
}
