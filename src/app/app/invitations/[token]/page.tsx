import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitationButton } from "@/components/events/accept-invitation-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { previewInvitation } from "@/modules/events/application/provider-service";
import { acceptInvitationAction } from "./actions";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

/** Secure link landing: requires sign-in (redirect with `next`), then shows what is being accepted. */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await requireActor(`/app/invitations/${token}`);
  const inv = await previewInvitation(token);

  if (!inv) {
    return <EmptyState title="Lien d'invitation invalide" description="Ce lien ne correspond à aucune invitation. Demandez à l'organisateur de vous en renvoyer un." action={<Button asChild variant="outline"><Link href="/app">Retour à mon espace</Link></Button>} />;
  }
  if (inv.state !== "valid") {
    const msg = inv.state === "expired" ? "Cette invitation a expiré (les liens sont valables 14 jours)." : inv.state === "revoked" ? "Cette invitation a été révoquée par l'organisateur." : "Cette invitation a déjà été utilisée.";
    return <EmptyState title="Invitation indisponible" description={`${msg} Demandez un nouveau lien à ${inv.inviterName ?? "l'organisateur"}.`} action={<Button asChild variant="outline"><Link href="/app/evenements">Mes évènements</Link></Button>} />;
  }
  const emailMismatch = inv.recipientEmail && inv.recipientEmail.toLowerCase() !== actor.email.toLowerCase();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{inv.eventName}</CardTitle>
          <CardDescription>
            {inv.inviterName ?? "L'organisateur"} vous invite à rejoindre l'espace de coordination de cet évènement en tant que <strong>{inv.roleLabel.toLowerCase()}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-2">
              {inv.eventDate ? formatDateFr(inv.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à définir"}
            </li>
            {inv.city && (
              <li className="flex items-center gap-2">
                {inv.city}
              </li>
            )}
          </ul>
          <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm">
            <p>
              Vous accepterez avec le compte <strong>{actor.email}</strong>. Vous accéderez au planning, aux messages et aux documents partagés avec vous ; les organisateurs peuvent lire tous les échanges de l'espace.
            </p>
          </div>
          {emailMismatch && <p className="text-sm text-warning-foreground">Cette invitation a été envoyée à {inv.recipientEmail}. Vous pouvez tout de même l'accepter avec ce compte : elle sera liée à votre identité actuelle.</p>}
          <div className="flex flex-wrap gap-2">
            <AcceptInvitationButton token={token} action={acceptInvitationAction} />
            <Button asChild variant="outline">
              <Link href="/app">Plus tard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
