import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AgencyTiers } from "@/components/billing/agency-tiers";
import { FormMessage } from "@/components/shared/form-message";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { formatEuros } from "@/lib/utils";
import { getAgencyState, loadAgencyPlan } from "@/modules/billing/application/agency-holds";
import { amountForQuantity } from "@/modules/billing/domain/tiered-pricing";
import { AGENCY_OWNER_BILLING_MESSAGE } from "@/modules/professionals/application/listing-slot";
import { getManagedListing } from "@/modules/professionals/application/professional-service";
import { billableExtraListings, countsAgainstQuota } from "@/modules/professionals/domain/listing-quota";
import { AgencyAddButtons } from "./agency-add-buttons";

export const metadata: Metadata = { title: "Ajouter une fiche à l'abonnement agence" };

/** Shown before an agency's extra listing enters review: price, new monthly total, payment or confirmation. */
export default async function AgencyAddPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paye?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/pro/${id}/ajout-agence`);
  const { listing } = await getManagedListing(actor, id).catch(() => notFound());
  if (countsAgainstQuota(listing.status)) redirect(`/app/pro/${id}`);
  if (!listing.organizationId) notFound();
  const [state, plan] = await Promise.all([getAgencyState(listing.organizationId), loadAgencyPlan()]);
  if (!state?.isVerifiedAgency || !plan) redirect(`/app/pro/${id}`);
  const tiers = plan.tiers;
  const needed = billableExtraListings(state.countedListings + 1);
  const covered = needed <= state.paidExtra;
  const before = amountForQuantity(tiers, state.subscriptionGrantsAccess ? state.paidExtra : 0);
  const after = amountForQuantity(tiers, needed);
  const name = listing.displayName || "Fiche sans nom";
  // Billing stays with the agency owner: members only send listings whose slot is already paid.
  const isOwner = state.organization.ownerUserId === actor.userId;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Ajouter cette fiche à l'abonnement agence" description={`« ${name} » est une fiche de plus pour votre agence. La première fiche est incluse, les suivantes sont facturées chaque mois au tarif dégressif.`} />
      {sp.paye === "1" && <FormMessage success="Paiement enregistré. Envoyez maintenant la fiche à la relecture." />}
      <Card className="gap-4 p-5 sm:p-6">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[16rem_1fr]">
          <dt className="text-muted-foreground">Fiches en ligne ou en relecture</dt>
          <dd className="tabular-nums">{state.countedListings}</dd>
          <dt className="text-muted-foreground">Après l'envoi de cette fiche</dt>
          <dd className="tabular-nums">{state.countedListings + 1}</dd>
          <dt className="text-muted-foreground">Abonnement agence actuel</dt>
          <dd className="tabular-nums">{state.subscriptionGrantsAccess ? `${formatEuros(before)} TTC par mois` : "Aucun"}</dd>
          <dt className="font-medium">Nouveau total</dt>
          <dd className="font-medium tabular-nums">{formatEuros(after)} TTC par mois</dd>
        </dl>
        <p className="text-sm text-muted-foreground text-pretty">
          {state.subscriptionGrantsAccess
            ? "Le changement s'applique tout de suite, au prorata de la période en cours. Si vous archivez une fiche plus tard, le montant baisse de la même façon."
            : "Le paiement ouvre l'abonnement agence. Il se renouvelle chaque mois et suit ensuite automatiquement le nombre de vos fiches."}
        </p>
        {covered ? (
          <AgencyAddButtons professionalId={id} mode="pay" label="Envoyer la fiche à la relecture" />
        ) : !isOwner ? (
          <p className="text-sm font-medium text-pretty">{AGENCY_OWNER_BILLING_MESSAGE}</p>
        ) : state.subscriptionGrantsAccess ? (
          <AgencyAddButtons professionalId={id} mode="confirm" label={`Ajouter la fiche (${formatEuros(after - before)} de plus par mois) et l'envoyer`} />
        ) : (
          <AgencyAddButtons professionalId={id} mode="pay" label={`Payer ${formatEuros(after)} par mois et continuer`} />
        )}
        <Link href={`/app/pro/${id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          Revenir à la fiche sans l'envoyer
        </Link>
      </Card>
      <Card className="gap-3 p-5">
        <h2 className="font-heading text-lg font-semibold">Tarif des fiches supplémentaires</h2>
        <AgencyTiers tiers={tiers} />
      </Card>
    </div>
  );
}
