import Link from "next/link";
import { Flag } from "lucide-react";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { canGlobal } from "@/modules/authorization";
import { CASE_STATUS_LABELS } from "@/modules/moderation/domain/decisions";
import { listAppeals, listReports, REPORT_REASON_LABELS, type ReportReason } from "@/modules/moderation/application/report-service";
import { requireAdminPage } from "../_lib/admin-page";
import { answerReporterAction, decideAppealAction, ensureReportCaseAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tous?: string }> }) {
  const { actor, twoFactorWarning } = await requireAdminPage("moderation.queue", "/admin/signalements");
  const sp = await searchParams;
  const all = sp.tous === "1";
  const [reports, appeals] = await Promise.all([listReports(actor, { open: !all }), listAppeals(actor, { open: !all })]);
  const canDecide = canGlobal(actor, "moderation.decide");
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Modération"
        title="Signalements et recours"
        description="Chaque signalement est rattaché à un cas de modération ; la décision et la réponse au signalant sont historisées."
        actions={
          <Link href={all ? "/admin/signalements" : "/admin/signalements?tous=1"} className="text-sm underline">
            {all ? "Voir seulement les ouverts" : "Voir l'historique complet"}
          </Link>
        }
      />
      <TwoFactorBanner show={twoFactorWarning} />
      <section className="space-y-3" aria-labelledby="signalements">
        <h2 id="signalements" className="text-lg font-semibold">
          Signalements ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <EmptyState icon={Flag} title="Aucun signalement" description={all ? "Aucun signalement enregistré." : "Aucun signalement en attente."} />
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id}>
                <Card className="gap-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p>
                      <StatusBadge tone="warning">{REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}</StatusBadge>
                      <span className="ml-2">
                        {r.resourceType} <code className="text-xs">{r.resourceId.slice(0, 8)}</code>
                      </span>
                      {r.professionalId && (
                        <Link href={`/admin/professionnels/${r.professionalId}`} className="ml-2 underline">
                          fiche
                        </Link>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {dateTime(r.createdAt)} · par {r.reporterName ?? r.reporterEmail ?? "anonyme"}
                    </p>
                  </div>
                  {r.details && <p className="whitespace-pre-wrap text-sm">{r.details}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {r.caseId ? (
                      <>
                        <Link href={`/admin/moderation/${r.caseId}`} className="underline">
                          Ouvrir le cas
                        </Link>
                        <span className="text-muted-foreground">({CASE_STATUS_LABELS[r.caseStatus ?? ""] ?? r.caseStatus})</span>
                      </>
                    ) : canDecide ? (
                      <ActionForm action={ensureReportCaseAction} className="space-y-0">
                        <input type="hidden" name="reportId" value={r.id} />
                        <ActionSubmit size="sm" variant="outline">
                          Ouvrir un cas
                        </ActionSubmit>
                      </ActionForm>
                    ) : null}
                  </div>
                  {canDecide && (
                    <details className="text-sm">
                      <summary className="cursor-pointer underline">Répondre au signalant</summary>
                      <ActionForm action={answerReporterAction} successMessage="Réponse envoyée." className="mt-2" resetOnSuccess>
                        <input type="hidden" name="reportId" value={r.id} />
                        <Textarea name="message" required minLength={10} rows={3} placeholder="Réponse motivée (notification in-app si le signalant a un compte ; sinon à envoyer manuellement à son e-mail)." aria-label="Réponse au signalant" />
                        <ActionSubmit size="sm">Envoyer la réponse</ActionSubmit>
                      </ActionForm>
                    </details>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="recours" id="recours">
        <h2 id="recours-title" className="text-lg font-semibold">
          Recours ({appeals.length})
        </h2>
        {appeals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun recours {all ? "" : "en attente"}.</p>
        ) : (
          <ul className="space-y-3">
            {appeals.map((a) => (
              <li key={a.id}>
                <Card className="gap-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p>
                      <span className="font-medium">{a.appellantName}</span> ({a.appellantEmail}) ·{" "}
                      <Link href={`/admin/moderation/${a.caseId}`} className="underline">
                        cas {a.caseKind}
                      </Link>
                    </p>
                    <p className="text-muted-foreground">
                      {dateTime(a.createdAt)} · <StatusBadge tone={a.status === "open" ? "warning" : a.status === "accepted" ? "success" : "neutral"}>{a.status}</StatusBadge>
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{a.argument}</p>
                  {a.decisionReason && <p className="text-xs text-muted-foreground">Décision : {a.decisionReason}</p>}
                  {a.status === "open" && canDecide && (
                    <ActionForm action={decideAppealAction} successMessage="Recours traité." className="space-y-2">
                      <input type="hidden" name="appealId" value={a.id} />
                      <Textarea name="reason" required minLength={10} rows={2} placeholder="Motif de la décision (transmis au demandeur)" aria-label="Motif" />
                      <div className="flex gap-2">
                        <ActionSubmit size="sm" name="outcome" value="accepted">
                          Accepter (puis décider sur le cas)
                        </ActionSubmit>
                        <ActionSubmit size="sm" variant="outline" name="outcome" value="rejected">
                          Rejeter
                        </ActionSubmit>
                      </div>
                    </ActionForm>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
