import Link from "next/link";
import { AdminTable } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { listToolsAdmin } from "@/modules/admin/application/catalog-admin";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.tools.manage", "/admin/outils");
  const rows = await listToolsAdmin(actor);
  return (
    <div className="space-y-6">
      <PageHeader title="Catalogue d'outils" description="Activation = pertinence métier ∧ rôle ∧ offre. L'usage agrégé provient des activations des fiches professionnelles." actions={<Button asChild><Link href="/admin/outils/nouveau">Nouvel outil</Link></Button>} />
      <TwoFactorBanner show={twoFactorWarning} />
      <AdminTable
        rows={rows}
        rowKey={(r) => r.key}
        emptyTitle="Aucun outil"
        columns={[
          { key: "name", header: "Outil", cell: (r) => (<div><Link href={`/admin/outils/${r.key}`} className="font-medium hover:underline">{r.name}</Link><p className="text-xs text-muted-foreground"><code>{r.key}</code> · {r.audience}{r.categorySlugs.length ? ` · ${r.categorySlugs.join(", ")}` : " · tous métiers"}</p></div>) },
          { key: "feature", header: "Offre requise", cell: (r) => (r.requiredFeature ? <StatusBadge tone="primary" dot={false}>{r.requiredFeature}</StatusBadge> : <span className="text-muted-foreground">gratuit</span>) },
          { key: "usage", header: "Activations / usages", cell: (r) => <span className="tabular-nums">{r.activations} / {r.uses}</span> },
          { key: "active", header: "Statut", cell: (r) => (r.isActive ? <StatusBadge tone="success">actif</StatusBadge> : <StatusBadge tone="neutral">inactif</StatusBadge>) },
        ]}
      />
    </div>
  );
}
