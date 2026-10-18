import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FormMessage } from "@/components/shared/form-message";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { VerificationBadge } from "@/components/directory/verification-badge";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { getAccountStructure } from "@/modules/professionals/application/agency-service";
import { listManagedListings } from "@/modules/professionals/application/professional-service";
import { STATUS_LABELS, STATUS_TONES } from "@/modules/professionals/domain/status";
import { PrimaryListingButton } from "./primary-listing-button";

export const metadata: Metadata = { title: "Fiche pro" };

function listingHref(l: { id: string; status: string }): string {
  return l.status === "draft" ? `/onboarding/professionnel?id=${l.id}&step=2` : `/app/pro/${l.id}`;
}

export default async function ProListingsPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const actor = await requireActor("/app/pro");
  const [listings, structure, sp] = await Promise.all([listManagedListings(actor), getAccountStructure(actor), searchParams]);
  const agency = structure.isVerifiedAgency;
  const managesOthers = listings.some((l) => l.ownerUserId !== actor.userId);
  // An independent has one listing: the list page is just a detour.
  const only = listings[0];
  if (!agency && !managesOthers && listings.length === 1 && only) redirect(listingHref(only));

  const primaryId = structure.organization?.primaryListingId ?? null;
  const canCreate = agency || listings.length === 0;
  const createLabel = listings.length === 0 ? "Créer ma fiche" : "Ajouter une fiche";
  return (
    <div className="space-y-8">
      <PageHeader
        title={agency ? "Mes fiches pro" : "Ma fiche pro"}
        description={
          agency
            ? "Les fiches de votre agence, leur statut de validation et ce qu'elles coûtent. La première est incluse, les suivantes sont facturées au tarif dégressif."
            : "Votre fiche dans l'annuaire, son statut de validation et son avancement."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/pro/structure">Ma structure</Link>
            </Button>
            {canCreate && (
              <Button asChild>
                <Link href="/onboarding/professionnel">{createLabel}</Link>
              </Button>
            )}
          </>
        }
      />
      {sp.paiement === "agence" && <FormMessage success="Paiement enregistré : votre abonnement agence est actif." />}
      {agency && structure.nextListingCents !== null && (
        <p className="text-sm text-muted-foreground">
          {structure.state?.subscriptionGrantsAccess ? `Abonnement agence : ${formatEuros(structure.monthlyCents)} TTC par mois pour ${structure.state.paidExtra} fiche(s) en plus de la première. ` : ""}
          Une fiche de plus coûterait {formatEuros(structure.nextListingCents)} TTC par mois, facturée quand vous l'envoyez à la relecture.
        </p>
      )}
      {listings.length === 0 ? (
        <EmptyState
          title="Aucune fiche pour le moment"
          description="Créez votre fiche en cinq étapes : métier, identité, activité, présentation, récapitulatif. Elle est relue par notre équipe avant publication."
          action={
            <Button asChild>
              <Link href="/onboarding/professionnel">Créer ma fiche</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {listings.map((l) => (
            <li key={l.id}>
              <Card className="h-full gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg leading-tight font-semibold">
                      <Link href={`/app/pro/${l.id}`} className="hover:underline">
                        {l.displayName || "Fiche sans nom"}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {l.categoryName}
                      {l.city ? `, ${l.city}` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={l.billingHoldAt ? "warning" : STATUS_TONES[l.status]}>{l.billingHoldAt ? "Retirée de l'annuaire" : STATUS_LABELS[l.status]}</StatusBadge>
                </div>
                {l.billingHoldAt && <p className="text-sm text-pretty">L'abonnement agence ne couvre plus cette fiche. Elle est conservée et revient dès le règlement.</p>}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Complétude {l.completenessScore} %</span>
                  <VerificationBadge level={l.verificationLevel} />
                  {l.ownerUserId !== actor.userId && <span className="text-xs">Via votre organisation</span>}
                </div>
                {agency && l.organizationId === structure.organization?.id && listings.length > 1 && (
                  <div className="text-sm">{l.id === primaryId ? <span className="text-muted-foreground">Reste visible en cas d'impayé</span> : <PrimaryListingButton professionalId={l.id} />}</div>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span>Modifiée le {formatDateFr(l.updatedAt)}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={listingHref(l)}>{l.status === "draft" ? "Reprendre" : "Ouvrir"}</Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
