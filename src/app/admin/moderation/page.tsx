import Link from "next/link";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { CASE_KIND_LABELS, CASE_STATUS_LABELS } from "@/modules/moderation/domain/decisions";
import { listCases } from "@/modules/moderation/application/moderation-service";
import { STATUS_LABELS, STATUS_TONES, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

type Search = { statut?: string; kind?: string; assigne?: string };

const KINDS = ["profile_review", "profile_update_review", "report", "review_moderation", "appeal"];

export default async function ModerationQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { actor, twoFactorWarning } = await requireAdminPage("moderation.queue", "/admin/moderation");
  const sp = await searchParams;
  const status = (["active", "open", "in_review", "resolved", "dismissed"].includes(sp.statut ?? "") ? sp.statut : "active") as "active" | "open" | "in_review" | "resolved" | "dismissed";
  const kind = KINDS.includes(sp.kind ?? "") ? sp.kind : undefined;
  const assigned = sp.assigne === "me" || sp.assigne === "unassigned" ? sp.assigne : undefined;
  const rows = await listCases(actor, { status, kind, assignedToUserId: assigned });
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { statut: sp.statut, kind: sp.kind, assigne: sp.assigne, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `/admin/moderation${p.size ? `?${p.toString()}` : ""}`;
  };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modération"
        title="File de modération"
        description="Fiches soumises, modifications majeures, signalements, avis et recours. Chaque décision est motivée et historisée."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/moderation/avis">Avis à modérer</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/signalements">Signalements</Link>
            </Button>
          </>
        }
      />
      <TwoFactorBanner show={twoFactorWarning} />
      <nav aria-label="Filtres" className="flex flex-wrap gap-2 text-sm">
        {[
          { label: "À traiter", href: link({ statut: undefined }), active: status === "active" },
          { label: "Résolus", href: link({ statut: "resolved" }), active: status === "resolved" },
          { label: "Classés", href: link({ statut: "dismissed" }), active: status === "dismissed" },
          { label: "Les miens", href: link({ assigne: sp.assigne === "me" ? undefined : "me" }), active: assigned === "me" },
          { label: "Non assignés", href: link({ assigne: sp.assigne === "unassigned" ? undefined : "unassigned" }), active: assigned === "unassigned" },
          ...KINDS.map((k) => ({ label: CASE_KIND_LABELS[k] ?? k, href: link({ kind: sp.kind === k ? undefined : k }), active: kind === k })),
        ].map((f) => (
          <Link key={f.label} href={f.href} className={`rounded-full border px-3 py-1 ${f.active ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`} aria-current={f.active ? "true" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Rien à modérer"
        emptyDescription="Aucun cas ne correspond à ces filtres."
        columns={[
          { key: "kind", header: "Type", cell: (r) => <StatusBadge tone={r.kind === "report" ? "warning" : r.kind === "appeal" ? "info" : "primary"}>{CASE_KIND_LABELS[r.kind] ?? r.kind}</StatusBadge> },
          {
            key: "subject",
            header: "Objet",
            cell: (r) => (
              <div className="min-w-0">
                <Link href={`/admin/moderation/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                  {r.professionalName ?? `${r.resourceType} ${r.resourceId.slice(0, 8)}`}
                </Link>
                {r.summary && <p className="max-w-md truncate text-xs text-muted-foreground">{r.summary}</p>}
              </div>
            ),
          },
          { key: "proStatus", header: "Statut fiche", cell: (r) => (r.professionalStatus ? <StatusBadge tone={STATUS_TONES[r.professionalStatus as ProfessionalStatus]}>{STATUS_LABELS[r.professionalStatus as ProfessionalStatus]}</StatusBadge> : "—") },
          { key: "status", header: "Cas", cell: (r) => CASE_STATUS_LABELS[r.status] ?? r.status },
          { key: "assignee", header: "Assigné à", cell: (r) => r.assignedToName ?? <span className="text-muted-foreground">—</span> },
          { key: "created", header: "Depuis", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}
