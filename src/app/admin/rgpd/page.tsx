import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck } from "lucide-react";
import { formatDateFr } from "@/lib/utils";
import { requireActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { listDataSubjectRequests } from "@/modules/privacy/application/dsr-service";
import { DSR_KIND_LABELS, DSR_STATUS_LABELS, DSR_STATUSES, daysUntil, dueTone, type DsrStatus } from "@/modules/privacy/domain/dsr";

export const metadata: Metadata = { title: "RGPD et demandes" };
export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: "open" | DsrStatus | "all"; label: string }> = [
  { key: "open", label: "À traiter" },
  ...DSR_STATUSES.map((s) => ({ key: s, label: DSR_STATUS_LABELS[s] })),
  { key: "all", label: "Toutes" },
];

export default async function AdminRgpdPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const actor = await requireActor("/admin/rgpd");
  if (!canGlobal(actor, "admin.users.manage")) redirect("/admin");
  const { statut } = await searchParams;
  const filter = FILTERS.find((f) => f.key === statut)?.key ?? "open";
  const rows = await listDataSubjectRequests(actor, filter === "all" ? {} : { status: filter });
  const overdue = rows.filter((r) => (r.status === "received" || r.status === "in_progress") && daysUntil(r.dueAt) < 0).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="RGPD et demandes"
        description="Demandes d'exercice de droits (accès, rectification, effacement…) à traiter sous un mois. Chaque changement de statut est journalisé."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/rgpd/registre">Registre des traitements</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/rgpd/analytique">Analytique produit</Link>
            </Button>
          </>
        }
      />
      {overdue > 0 && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {overdue} demande{overdue > 1 ? "s" : ""} en retard : le délai légal d'un mois est dépassé.
        </p>
      )}
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "open" ? "/admin/rgpd" : `/admin/rgpd?statut=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Aucune demande dans cette vue" description="Les demandes déposées depuis l'espace des utilisateurs ou créées par la politique de rétention apparaissent ici." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Demande</TableHead>
                <TableHead>Personne</TableHead>
                <TableHead>Reçue le</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="sr-only">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const d = daysUntil(r.dueAt);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{DSR_KIND_LABELS[r.kind]}</TableCell>
                    <TableCell>
                      <span className="block">{r.userName ?? "Compte supprimé"}</span>
                      <span className="block text-xs text-muted-foreground">{r.email}</span>
                    </TableCell>
                    <TableCell>{formatDateFr(r.createdAt)}</TableCell>
                    <TableCell>
                      {formatDateFr(r.dueAt)}
                      {(r.status === "received" || r.status === "in_progress") && <span className={`block text-xs ${d < 0 ? "text-destructive" : "text-muted-foreground"}`}>{d < 0 ? `${-d} j de retard` : `${d} j restants`}</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={dueTone(r.dueAt, r.status)}>{DSR_STATUS_LABELS[r.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/rgpd/${r.id}`}>Traiter</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
