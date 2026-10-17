import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { DsrStatusForm } from "@/components/privacy/dsr-status-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { formatDateFr } from "@/lib/utils";
import { requireActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { getDataSubjectRequest } from "@/modules/privacy/application/dsr-service";
import { DSR_KIND_LABELS, DSR_STATUS_LABELS, daysUntil, dueTone } from "@/modules/privacy/domain/dsr";

export const metadata: Metadata = { title: "Demande RGPD" };
export const dynamic = "force-dynamic";

const GUIDANCE: Record<string, string[]> = {
  access: ["Vérifier l'identité si la demande n'émane pas du compte connecté.", "Produire l'export (JSON) et le transmettre par un canal sécurisé.", "Clore en résumant ce qui a été fourni."],
  rectification: ["Identifier la donnée inexacte et la corriger dans le back-office ou demander à la personne de le faire.", "Informer les destinataires si la donnée a été communiquée (art. 19).", "Clore avec la correction effectuée."],
  erasure: ["Vérifier les obligations de conservation (facturation, litige, sécurité) et les documenter.", "Supprimer compte, fiches, évènements dont la personne est propriétaire ; anonymiser ce qui doit rester.", "Prévenir les sous-traitants concernés (paiement, e-mail).", "Clore avec la date effective de suppression."],
  restriction: ["Geler le traitement visé (ex. retirer une fiche de l'annuaire) le temps de l'analyse.", "Informer la personne avant de lever la limitation."],
  portability: ["Fournir l'export JSON (format structuré, lisible par machine).", "Ne transmettre à un tiers que si la personne le demande explicitement."],
  objection: ["Analyser les motifs légitimes impérieux éventuels.", "Cesser le traitement contesté si aucune base ne l'emporte (ex. e-mails non essentiels)."],
};

export default async function AdminDsrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("/admin/rgpd");
  if (!canGlobal(actor, "admin.users.manage")) redirect("/admin");
  const { id } = await params;
  let row: Awaited<ReturnType<typeof getDataSubjectRequest>>;
  try {
    row = await getDataSubjectRequest(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "not_found") notFound();
    throw e;
  }
  const history = await db
    .select({ id: auditLogs.id, action: auditLogs.action, metadata: auditLogs.metadata, reason: auditLogs.reason, createdAt: auditLogs.createdAt, actorUserId: auditLogs.actorUserId })
    .from(auditLogs)
    .where(eq(auditLogs.resourceId, id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  const d = daysUntil(row.dueAt);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<Link href="/admin/rgpd">← RGPD et demandes</Link>}
        title={DSR_KIND_LABELS[row.kind]}
        description={`Déposée le ${formatDateFr(row.createdAt)} par ${row.userName ?? row.email}`}
        actions={<StatusBadge tone={dueTone(row.dueAt, row.status)}>{DSR_STATUS_LABELS[row.status]}</StatusBadge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Détails</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Personne</dt>
                <dd className="font-medium">{row.userName ?? "Compte supprimé"}</dd>
                <dd>{row.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Échéance légale</dt>
                <dd className="font-medium">{formatDateFr(row.dueAt)}</dd>
                <dd className={d < 0 && !row.completedAt ? "text-destructive" : "text-muted-foreground"}>{row.completedAt ? `Traitée le ${formatDateFr(row.completedAt)}` : d < 0 ? `${-d} jour(s) de retard` : `${d} jour(s) restants`}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Précisions de la personne</dt>
                <dd className="whitespace-pre-wrap">{row.details || "—"}</dd>
              </div>
            </dl>
            {row.userId && (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href={`/admin/utilisateurs/${row.userId}`}>Ouvrir la fiche utilisateur</Link>
              </Button>
            )}
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Changer le statut</h2>
            <div className="mt-4">
              <DsrStatusForm id={row.id} current={row.status} />
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-2xl border bg-muted/40 p-6">
            <h2 className="text-lg font-semibold">Marche à suivre</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
              {(GUIDANCE[row.kind] ?? []).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">Procédure complète : docs/privacy.md et docs/operations.md.</p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Historique</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucune entrée.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {history.map((h) => {
                  const meta = h.metadata as { from?: string; to?: string };
                  return (
                    <li key={h.id} className="border-l-2 border-primary/40 pl-3">
                      <p className="font-medium">{h.action === "privacy.dsr.status_changed" ? `${DSR_STATUS_LABELS[meta.from as keyof typeof DSR_STATUS_LABELS] ?? meta.from} → ${DSR_STATUS_LABELS[meta.to as keyof typeof DSR_STATUS_LABELS] ?? meta.to}` : "Demande créée"}</p>
                      <p className="text-muted-foreground">{formatDateFr(h.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      {h.reason && <p className="mt-1 whitespace-pre-wrap">{h.reason}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
