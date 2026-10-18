import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { VerificationBadge } from "@/components/directory/verification-badge";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { listManagedListings } from "@/modules/professionals/application/professional-service";
import { STATUS_LABELS, STATUS_TONES } from "@/modules/professionals/domain/status";

export const metadata: Metadata = { title: "Mes fiches pro" };

export default async function ProListingsPage() {
  const actor = await requireActor("/app/pro");
  const listings = await listManagedListings(actor);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Mes fiches pro"
        description="Vos fiches dans l'annuaire, leur statut de validation et leur avancement."
        actions={
          <Button asChild>
            <Link href="/onboarding/professionnel">
              Créer une fiche
            </Link>
          </Button>
        }
      />
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
                      {l.city ? ` · ${l.city}` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={STATUS_TONES[l.status]}>{STATUS_LABELS[l.status]}</StatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Complétude {l.completenessScore} %</span>
                  <VerificationBadge level={l.verificationLevel} />
                  {l.ownerUserId !== actor.userId && <span className="text-xs">Via votre organisation</span>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span>Modifiée le {formatDateFr(l.updatedAt)}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={l.status === "draft" ? `/onboarding/professionnel?id=${l.id}&step=2` : `/app/pro/${l.id}`}>{l.status === "draft" ? "Reprendre" : "Ouvrir"}</Link>
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
