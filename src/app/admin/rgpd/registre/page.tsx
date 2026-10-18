import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateFr } from "@/lib/utils";
import { requireActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { listRetentionJobs } from "@/modules/privacy/application/retention";
import { getRetentionSettings } from "@/modules/privacy/application/settings";
import { PROCESSING_REGISTRY, PROCESSOR_LIST } from "@/modules/privacy/domain/processing-registry";
import { resolveVariables } from "@/modules/legal/domain/variables";

export const metadata: Metadata = { title: "Registre des traitements" };
export const dynamic = "force-dynamic";

export default async function RegistryPage() {
  const actor = await requireActor("/admin/rgpd/registre");
  if (!canGlobal(actor, "admin.users.manage")) redirect("/admin");
  const [settings, jobs] = await Promise.all([getRetentionSettings(), listRetentionJobs(30)]);
  const vars = {
    "retention.children_days_after_event": String(settings.childrenDaysAfterEvent),
    "retention.inactive_account_months": String(settings.inactiveAccountMonths),
    "retention.audit_logs_months": String(settings.auditLogsMonths),
  };
  const r = (text: string) => resolveVariables(text, vars).text;

  return (
    <div className="space-y-10">
      <Link href="/admin/rgpd" className="text-sm text-muted-foreground hover:underline">Retour à RGPD et demandes</Link>
      <PageHeader
        title="Registre des traitements"
        description="Article 30 du RGPD. Les points « À COMPLÉTER » sont des décisions à prendre par la direction, avec l'appui d'un conseil juridique. Source : src/modules/privacy/domain/processing-registry.ts."
      />

      <section aria-labelledby="retention-title" className="rounded-2xl border bg-card p-6">
        <h2 id="retention-title" className="text-lg font-semibold">
          Durées configurées et exécution
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Anonymisation des enfants</dt>
            <dd className="font-medium">{settings.childrenDaysAfterEvent} jours après l'évènement</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Comptes inactifs</dt>
            <dd className="font-medium">{settings.inactiveAccountMonths} mois : demande d'effacement</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Journaux d'audit</dt>
            <dd className="font-medium">{settings.auditLogsMonths} mois</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Modifiables dans{" "}
          <Link href="/admin/parametres" className="underline underline-offset-4">
            Paramètres
          </Link>{" "}
          (clés retention.*). Appliquées chaque nuit par le worker.
        </p>
        <h3 className="mt-6 text-sm font-semibold">Dernières exécutions</h3>
        {jobs.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Aucune exécution enregistrée : le worker n'a pas encore lancé la rétention.</p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Politique</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Lignes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.policy}</TableCell>
                    <TableCell>{formatDateFr(j.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>
                      <StatusBadge tone={j.status === "succeeded" ? "success" : j.status === "failed" ? "danger" : "neutral"}>{j.status}</StatusBadge>
                      {j.error && <span className="block text-xs text-destructive">{j.error}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{j.affectedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="processors-title">
        <h2 id="processors-title" className="text-lg font-semibold">
          Sous-traitants
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Prestataire</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROCESSOR_LIST.map((p) => (
                <TableRow key={p.role}>
                  <TableCell className="font-medium">{p.role}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.location}</TableCell>
                  <TableCell>{p.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="activities-title" className="space-y-6">
        <h2 id="activities-title" className="text-lg font-semibold">
          Activités de traitement
        </h2>
        {PROCESSING_REGISTRY.map((a) => (
          <article key={a.key} className="rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{a.name}</h3>
              {a.sensitive && <StatusBadge tone="warning">Données sensibles / mineurs</StatusBadge>}
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Finalité</dt>
                <dd>{a.purpose}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Base légale</dt>
                <dd>{a.legalBasis}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Personnes concernées</dt>
                <dd>{a.subjects}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Catégories de données</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {a.dataCategories.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Destinataires</dt>
                <dd>{a.recipients}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Conservation</dt>
                <dd>{r(a.retention)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mesures de sécurité</dt>
                <dd>{a.security}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Tables</dt>
                <dd className="font-mono text-xs">{a.tables.join(", ")}</dd>
              </div>
              {a.openPoints && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Points ouverts</dt>
                  <dd>
                    <ul className="list-disc pl-5">
                      {a.openPoints.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
