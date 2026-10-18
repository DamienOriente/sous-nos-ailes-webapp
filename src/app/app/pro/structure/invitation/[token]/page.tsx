import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitationButton } from "@/components/events/accept-invitation-button";
import { SwitchAccountButton } from "@/components/professionals/switch-account-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { previewOrganizationInvitation } from "@/modules/professionals/application/member-service";
import { ORGANIZATION_ROLE_DESCRIPTIONS, type InvitableRole } from "@/modules/professionals/domain/members";
import { acceptOrganizationInvitationAction } from "./actions";

export const metadata: Metadata = { title: "Invitation dans une équipe", robots: { index: false } };

const UNAVAILABLE: Record<"expired" | "revoked" | "used" | "agency_unavailable", string> = {
  expired: "Ce lien a expiré.",
  revoked: "Cette invitation a été annulée par l'agence.",
  used: "Cette invitation a déjà été utilisée.",
  agency_unavailable: "Cette agence n'accepte plus de nouveaux membres pour le moment.",
};

/** Landing of the e-mailed link: sign-in first (redirect with `next`), then the account must match the invited address. */
export default async function OrganizationInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await requireActor(`/app/pro/structure/invitation/${token}`);
  const inv = await previewOrganizationInvitation(token);
  const back = (
    <Button asChild variant="outline">
      <Link href="/app">Retour à mon espace</Link>
    </Button>
  );

  if (!inv) return <EmptyState title="Lien d'invitation invalide" description="Ce lien ne correspond à aucune invitation. Demandez à l'agence de vous en envoyer un nouveau." action={back} />;
  if (inv.state !== "valid") return <EmptyState title="Invitation indisponible" description={`${UNAVAILABLE[inv.state]} Demandez un nouveau lien à ${inv.inviterName ?? "l'agence"}.`} action={back} />;

  const emailMatches = inv.email === actor.email.toLowerCase();
  return (
    <div className="mx-auto max-w-xl">
      <Card className="gap-4 p-5 sm:p-6">
        <h1 className="font-heading text-2xl font-semibold">Rejoindre l&apos;équipe de {inv.organizationName}</h1>
        <p className="text-sm text-pretty">
          {inv.inviterName ?? "L'agence"} vous invite en tant que <strong>{inv.roleLabel.toLowerCase()}</strong>.{" "}
          {inv.role in ORGANIZATION_ROLE_DESCRIPTIONS ? ORGANIZATION_ROLE_DESCRIPTIONS[inv.role as InvitableRole] : ""}
        </p>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Adresse invitée</dt>
          <dd>{inv.email}</dd>
          <dt className="text-muted-foreground">Lien valable jusqu&apos;au</dt>
          <dd>{formatDateFr(inv.expiresAt)}</dd>
        </dl>
        <p className="text-sm text-muted-foreground text-pretty">L&apos;abonnement de l&apos;agence reste au nom de son propriétaire : vous ne pourrez ni l&apos;ouvrir ni le modifier.</p>
        {emailMatches ? (
          <div className="flex flex-wrap items-start gap-2">
            <AcceptInvitationButton token={token} action={acceptOrganizationInvitationAction} />
            <Button asChild variant="outline">
              <Link href="/app">Plus tard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-pretty">
              Vous êtes connecté avec {actor.email}. Cette invitation est réservée à {inv.email} : connectez-vous avec cette adresse pour l&apos;accepter.
            </p>
            <SwitchAccountButton nextPath={`/app/pro/structure/invitation/${token}`} />
          </div>
        )}
      </Card>
    </div>
  );
}
