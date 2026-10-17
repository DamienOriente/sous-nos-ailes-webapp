import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
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
    { href: base, label: "Tableau de bord", icon: "dashboard", exact: true },
    { href: `${base}/fiche`, label: "Ma fiche", icon: "store" },
    { href: `${base}/page`, label: "Ma page publique", icon: "page" },
    { href: `${base}/prestations`, label: "Prestations", icon: "tags" },
    { href: `${base}/disponibilites`, label: "Disponibilités", icon: "calendar" },
    { href: `${base}/demandes`, label: "Demandes", icon: "inquiries", badge: counts.new ?? 0 },
    { href: `${base}/outils`, label: "Outils métier", icon: "tools" },
    { href: `${base}/verification`, label: "Vérification", icon: "verification" },
    { href: `${base}/avis`, label: "Avis", icon: "messages" },
    { href: `${base}/seo`, label: "SEO", icon: "seo" },
    { href: `${base}/statistiques`, label: "Statistiques", icon: "stats" },
    { href: `${base}/abonnement`, label: "Abonnement", icon: "billing" },
  ];
  const { listing, category } = managed;
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            <Link href="/app/pro" className="hover:underline">
              Mes fiches pro
            </Link>{" "}
            / {category.name}
          </p>
          <h1 className="truncate font-heading text-2xl font-semibold sm:text-3xl" data-testid="listing-title">
            {listing.displayName || "Fiche sans nom"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</StatusBadge>
            {listing.isDemo && <StatusBadge tone="neutral">Démo</StatusBadge>}
          </div>
        </div>
        {listing.status === "published" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/pro/${listing.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
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
