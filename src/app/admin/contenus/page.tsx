import Link from "next/link";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { listEditorialPages } from "@/modules/admin/application/editorial-service";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

export default async function EditorialPagesList() {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.content.manage", "/admin/contenus");
  const { pages, missing } = await listEditorialPages(actor);
  return (
    <div className="space-y-6">
      <PageHeader title="Pages éditoriales" description="Mentions légales, CGU/CGV, politiques, FAQ. Syntaxe restreinte (aucun HTML) et variables {{legal.*}} résolues depuis les paramètres." actions={<Button asChild><Link href="/admin/contenus/nouvelle-page">Nouvelle page</Link></Button>} />
      <TwoFactorBanner show={twoFactorWarning} />
      {missing.length > 0 && (
        <p className="rounded-lg bg-warning/15 px-4 py-3 text-sm">
          Pages attendues par le site mais absentes de la base (le texte par défaut du module juridique est affiché, en brouillon) :{" "}
          {missing.map((s) => (
            <Link key={s} href={`/admin/contenus/${s}`} className="mr-2 underline">
              {s}
            </Link>
          ))}
        </p>
      )}
      <AdminTable
        rows={pages}
        rowKey={(r) => r.slug}
        emptyTitle="Aucune page"
        columns={[
          { key: "title", header: "Page", cell: (r) => (<div><Link href={`/admin/contenus/${r.slug}`} className="font-medium hover:underline">{r.title}</Link><p className="text-xs text-muted-foreground">/{r.slug}</p></div>) },
          { key: "status", header: "Statut", cell: (r) => (r.isPublished === "published" ? <StatusBadge tone="success">publiée</StatusBadge> : <StatusBadge tone="neutral">brouillon</StatusBadge>) },
          { key: "updated", header: "Modifiée le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.updatedAt)}</span> },
        ]}
      />
    </div>
  );
}
