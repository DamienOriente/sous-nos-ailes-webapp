import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProWorkspaceNav, type ProNavItem } from "@/components/professionals/pro-workspace-nav";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { countInquiriesByStatus } from "@/modules/inquiries/application/inquiry-service";
import { getManagedListing } from "@/modules/professionals/application/professional-service";
import { STATUS_LABELS, STATUS_TONES } from "@/modules/professionals/domain/status";

/**
 * Professional workspace shell. Authorisation happens here
 * (`requireProfessionalManage` inside getManagedListing) and again in every
 * page/action: the listing lookup is request-cached so pages pay nothing extra.
 */
export default async function ProWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}`);
  let managed;
  try {
    managed = await getManagedListing(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const counts = await countInquiriesByStatus(actor, id);
  const base = `/app/pro/${id}`;
  const items: ProNavItem[] = [
    { href: base, label: "Tableau de bord", exact: true },
    { href: `${base}/fiche`, label: "Ma fiche" },
    { href: `${base}/page`, label: "Ma page publique" },
    { href: `${base}/prestations`, label: "Prestations" },
    { href: `${base}/disponibilites`, label: "Disponibilités" },
    { href: `${base}/demandes`, label: "Demandes", badge: counts.new ?? 0 },
    { href: `${base}/outils`, label: "Outils métier" },
    { href: `${base}/verification`, label: "Vérification" },
    { href: `${base}/avis`, label: "Avis" },
    { href: `${base}/partenaires`, label: "Partenaires" },
    { href: `${base}/seo`, label: "SEO" },
    { href: `${base}/statistiques`, label: "Statistiques" },
    { href: `${base}/abonnement`, label: "Abonnement" },
  ];
  const { listing, category } = managed;
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-heading text-2xl font-semibold sm:text-3xl" data-testid="listing-title">
            {listing.displayName || "Fiche sans nom"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</StatusBadge>
            <span className="text-sm text-muted-foreground">{category.name}</span>
          </div>
        </div>
        {listing.status === "published" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/pro/${listing.slug}`} target="_blank" rel="noreferrer">
              Voir ma page publique
            </Link>
          </Button>
        )}
      </header>
      <ProWorkspaceNav items={items} />
      <div>{children}</div>
    </div>
  );
}
