import Link from "next/link";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { professionalCategories, professionals, users } from "@/db/schema";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROFESSIONAL_STATUSES, STATUS_LABELS, STATUS_TONES, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

export default async function ProfessionalsAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  const { twoFactorWarning } = await requireAdminPage("moderation.queue", "/admin/professionnels");
  const sp = await searchParams;
  const status = (PROFESSIONAL_STATUSES as readonly string[]).includes(sp.statut ?? "") ? (sp.statut as ProfessionalStatus) : undefined;
  const conds = [];
  if (sp.q) conds.push(or(ilike(professionals.displayName, `%${sp.q}%`), ilike(professionals.slug, `%${sp.q}%`), ilike(users.email, `%${sp.q}%`)));
  if (status) conds.push(eq(professionals.status, status));
  else conds.push(isNull(professionals.deletedAt));
  const rows = await db
    .select({ id: professionals.id, displayName: professionals.displayName, slug: professionals.slug, status: professionals.status, city: professionals.city, verificationLevel: professionals.verificationLevel, completenessScore: professionals.completenessScore, isDemo: professionals.isDemo, createdAt: professionals.createdAt, ownerEmail: users.email, categoryName: professionalCategories.name })
    .from(professionals)
    .innerJoin(users, eq(users.id, professionals.ownerUserId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(professionals.displayName))
    .limit(300);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Professionnels" description="Toutes les fiches, quel que soit leur statut. Les décisions se prennent depuis la fiche ou la file de modération." />
      <TwoFactorBanner show={twoFactorWarning} />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex-1 min-w-56">
          <label htmlFor="q" className="sr-only">Rechercher</label>
          <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Nom, slug ou e-mail du propriétaire" />
        </div>
        <select name="statut" defaultValue={sp.statut ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Statut">
          <option value="">Tous (hors archivés)</option>
          {PROFESSIONAL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filtrer</Button>
      </form>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucune fiche"
        columns={[
          { key: "name", header: "Fiche", cell: (r) => (<div><Link href={`/admin/professionnels/${r.id}`} className="font-medium hover:underline">{r.displayName}</Link><p className="text-xs text-muted-foreground">{r.categoryName} · {r.city ?? "—"} · {r.ownerEmail}{r.isDemo ? " · démo" : ""}</p></div>) },
          { key: "status", header: "Statut", cell: (r) => <StatusBadge tone={STATUS_TONES[r.status as ProfessionalStatus]}>{STATUS_LABELS[r.status as ProfessionalStatus]}</StatusBadge> },
          { key: "quality", header: "Complétude / vérif.", cell: (r) => <span className="tabular-nums">{r.completenessScore} % · niv. {r.verificationLevel}</span> },
          { key: "created", header: "Créée le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}
