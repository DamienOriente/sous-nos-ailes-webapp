import Link from "next/link";
import { AdminTable } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { listCategoriesAdmin } from "@/modules/admin/application/catalog-admin";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.categories.manage", "/admin/categories");
  const rows = await listCategoriesAdmin(actor);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalogue" title="Catégories et métiers" description="Une catégorie utilisée par des fiches ne se supprime pas : désactivez-la pour la masquer." actions={<Button asChild><Link href="/admin/categories/nouvelle">Nouvelle catégorie</Link></Button>} />
      <TwoFactorBanner show={twoFactorWarning} />
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucune catégorie"
        columns={[
          { key: "name", header: "Catégorie", cell: (r) => (<div><Link href={`/admin/categories/${r.id}`} className="font-medium hover:underline">{r.name}</Link><p className="text-xs text-muted-foreground">{r.slug} · {r.group}{r.isChildcare ? " · enfants" : ""}</p></div>) },
          { key: "form", header: "Formulaire", cell: (r) => <code className="text-xs">{r.formSchemaKey}</code> },
          { key: "usage", header: "Fiches", cell: (r) => <span className="tabular-nums">{r.usageCount}</span> },
          { key: "order", header: "Ordre", cell: (r) => r.sortOrder },
          { key: "active", header: "Statut", cell: (r) => (r.isActive ? <StatusBadge tone="success">active</StatusBadge> : <StatusBadge tone="neutral">masquée</StatusBadge>) },
        ]}
      />
    </div>
  );
}
