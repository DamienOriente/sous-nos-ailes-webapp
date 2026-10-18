import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { professionals } from "@/db/schema";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSetting } from "@/modules/admin/application/settings-service";
import { listFeaturedPlacementsAdmin } from "@/modules/billing/application/featured-placements";
import { requireAdminPage } from "../../_lib/admin-page";
import { createPlacementAction, togglePlacementAction } from "../actions";
import { OffersSubnav } from "../page";

export const dynamic = "force-dynamic";

export default async function SponsoredPage() {
  const { actor } = await requireAdminPage("admin.plans.manage", "/admin/offres/sponsorises");
  const [rows, published, cap] = await Promise.all([listFeaturedPlacementsAdmin(actor), db.select({ id: professionals.id, displayName: professionals.displayName }).from(professionals).where(eq(professionals.status, "published")).orderBy(asc(professionals.displayName)), getSetting<number>("sponsored.max_per_query", 2)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Placements sponsorisés" description={`Éligibilité : fiche publiée + offre incluant « sponsored.eligible ». Au plus ${cap} résultat(s) sponsorisé(s) par recherche (paramètre sponsored.max_per_query), toujours étiquetés.`} />
      <OffersSubnav current="/admin/offres/sponsorises" />
      <Card className="gap-3 p-6">
        <h2 className="font-semibold">Nouveau placement</h2>
        <ActionForm action={createPlacementAction} successMessage="Placement créé." resetOnSuccess className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <select name="professionalId" required className="h-9 rounded-md border bg-background px-2 text-sm sm:col-span-2" aria-label="Professionnel">
            <option value="">Professionnel publié…</option>
            {published.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
          <Input name="categorySlug" placeholder="Catégorie (slug, vide = toutes)" aria-label="Catégorie" />
          <Input name="department" placeholder="Département (ex. 31)" aria-label="Département" />
          <div className="flex gap-2">
            <Input name="startsAt" type="date" required aria-label="Début" />
            <Input name="endsAt" type="date" required aria-label="Fin" />
          </div>
          <ActionSubmit variant="outline">Créer</ActionSubmit>
        </ActionForm>
      </Card>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucun placement"
        columns={[
          { key: "pro", header: "Professionnel", cell: (r) => (<div><span className="font-medium">{r.displayName}</span>{r.proStatus !== "published" && <StatusBadge tone="danger" className="ml-2">fiche {r.proStatus}</StatusBadge>}</div>) },
          { key: "scope", header: "Périmètre", cell: (r) => `${r.categorySlug ?? "toutes catégories"} · ${r.department ?? "tous départements"}` },
          { key: "period", header: "Période", cell: (r) => <span className="text-muted-foreground">du {dateTime(r.startsAt)} au {dateTime(r.endsAt)}</span> },
          {
            key: "status",
            header: "Statut",
            cell: (r) => (
              <ActionForm action={togglePlacementAction} className="flex items-center gap-2 space-y-0">
                <input type="hidden" name="placementId" value={r.id} />
                <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                {!r.isActive ? <StatusBadge tone="neutral">désactivé</StatusBadge> : r.phase === "ended" ? <StatusBadge tone="neutral">terminé</StatusBadge> : r.phase === "upcoming" ? <StatusBadge tone="info">à venir</StatusBadge> : <StatusBadge tone="success">en cours</StatusBadge>}
                <ActionSubmit size="sm" variant="outline">{r.isActive ? "Désactiver" : "Réactiver"}</ActionSubmit>
              </ActionForm>
            ),
          },
        ]}
      />
    </div>
  );
}
