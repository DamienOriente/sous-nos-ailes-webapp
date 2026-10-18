import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { dateTime } from "@/components/admin/admin-table";
import { DecisionForm } from "@/components/admin/decision-form";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotFoundError } from "@/lib/errors";
import { formatEuros } from "@/lib/utils";
import { canGlobal } from "@/modules/authorization";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { CASE_KIND_LABELS, CASE_STATUS_LABELS, DECISION_LABELS, type Decision } from "@/modules/moderation/domain/decisions";
import { getCaseDetail, listModeratorsForAssignment } from "@/modules/moderation/application/moderation-service";
import { STATUS_LABELS, STATUS_TONES, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { DOCUMENT_KIND_LABELS, VERIFICATION_KIND_LABELS, VERIFICATION_KINDS, verificationLevelLabel, type DocumentKind } from "@/modules/professionals/domain/verification";
import { requireAdminPage } from "../../_lib/admin-page";
import { assignCaseAction, decideCaseAction, reviewDocumentAction, reviewVerificationAction } from "../actions";

export const dynamic = "force-dynamic";

function allowedDecisions(kind: string, proStatus: ProfessionalStatus | null, caseStatus: string): Decision[] {
  if (caseStatus === "resolved" || caseStatus === "dismissed") return ["note"];
  switch (kind) {
    case "profile_review":
      return ["approve", "request_changes", "reject", "note", "escalate"];
    case "profile_update_review":
      return proStatus === "suspended" ? ["reinstate", "reject", "note", "escalate"] : ["approve", "request_changes", "suspend", "dismiss", "note", "escalate"];
    case "report":
      return proStatus ? ["dismiss", "suspend", "reinstate", "request_changes", "note", "escalate"] : ["dismiss", "note", "escalate"];
    case "appeal":
      return proStatus === "suspended" || proStatus === "rejected" ? ["reinstate", "approve", "dismiss", "note"] : ["dismiss", "note"];
    default:
      return ["dismiss", "note", "escalate"];
  }
}

export default async function ModerationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, twoFactorWarning } = await requireAdminPage("moderation.queue", `/admin/moderation/${id}`);
  let detail;
  try {
    detail = await getCaseDetail(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const moderators = await listModeratorsForAssignment();
  const { case: c, professional: pro } = detail;
  const canDecide = canGlobal(actor, "moderation.decide");
  const canSeeDocs = canGlobal(actor, "moderation.documents.view");
  const proStatus = (pro?.status ?? null) as ProfessionalStatus | null;
  const decisions = allowedDecisions(c.kind, proStatus, c.status);

  return (
    <div className="space-y-6">
      <Link href="/admin/moderation" className="text-sm text-muted-foreground hover:underline">Retour à la file de modération</Link>
      <PageHeader
        title={pro ? pro.displayName : `${c.resourceType} ${c.resourceId.slice(0, 8)}`}
        description={c.summary ?? undefined}
        actions={
          <>
            <StatusBadge tone="primary">{CASE_KIND_LABELS[c.kind] ?? c.kind}</StatusBadge>
            <StatusBadge tone={c.status === "resolved" ? "success" : c.status === "dismissed" ? "neutral" : "warning"}>{CASE_STATUS_LABELS[c.status] ?? c.status}</StatusBadge>
          </>
        }
      />
      <TwoFactorBanner show={twoFactorWarning} />
      {c.resourceType === "message" && (
        <Card className="p-4 text-sm">
          Message signalé :{" "}
          <Link href={`/admin/moderation/messages/${c.resourceId}`} className="underline">
            lire uniquement ce message
          </Link>
          .
        </Card>
      )}
      {c.resourceType === "review" && (
        <Card className="p-4 text-sm">
          Avis signalé :{" "}
          <Link href={`/admin/moderation/avis?focus=${c.resourceId}`} className="underline">
            ouvrir dans la modération des avis
          </Link>
          .
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {pro && (
            <Card className="gap-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Fiche professionnelle (lecture)</h2>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={STATUS_TONES[pro.status as ProfessionalStatus]}>{STATUS_LABELS[pro.status as ProfessionalStatus]}</StatusBadge>
                  <Link href={`/admin/professionnels/${pro.id}`} className="text-sm underline">
                    Fiche admin
                  </Link>
                  {pro.status === "published" && (
                    <Link href={`/pro/${pro.slug}`} className="text-sm underline" target="_blank">
                      Page publique
                    </Link>
                  )}
                </div>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Métier</dt><dd>{pro.categoryName}</dd></div>
                <div><dt className="text-muted-foreground">Lieu</dt><dd>{[pro.city, pro.postalCode, pro.department].filter(Boolean).join(" · ") || "Non renseigné"} (rayon {pro.interventionRadiusKm} km)</dd></div>
                <div><dt className="text-muted-foreground">Propriétaire</dt><dd>{pro.ownerName}, {pro.ownerEmail}</dd></div>
                <div><dt className="text-muted-foreground">Tarifs</dt><dd>{pro.priceFromCents ? `${formatEuros(pro.priceFromCents)}${pro.priceToCents ? ` – ${formatEuros(pro.priceToCents)}` : ""} ${pro.priceUnit ?? ""}` : "Non renseigné"}</dd></div>
                <div><dt className="text-muted-foreground">Expérience</dt><dd>{pro.yearsExperience ? `${pro.yearsExperience} ans` : "Non renseignée"}</dd></div>
                <div><dt className="text-muted-foreground">Complétude / vérification</dt><dd>{pro.completenessScore} % · niveau {pro.verificationLevel} ({verificationLevelLabel(pro.verificationLevel)})</dd></div>
                <div><dt className="text-muted-foreground">Services enfants</dt><dd>{pro.acceptsChildrenServices ? "Oui" : "Non"}</dd></div>
                <div><dt className="text-muted-foreground">Contact public</dt><dd>{[pro.publicEmail, pro.publicPhone, pro.website].filter(Boolean).join(" · ") || "Non renseigné"}</dd></div>
              </dl>
              {pro.tagline && <p className="font-medium">{pro.tagline}</p>}
              {pro.description && <p className="whitespace-pre-wrap text-sm text-pretty">{pro.description}</p>}
              {Object.keys(pro.tradeDetails).filter((k) => !k.startsWith("__")).length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">Détails métier déclarés</summary>
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                    {Object.entries(pro.tradeDetails)
                      .filter(([k]) => !k.startsWith("__"))
                      .map(([k, v]) => (
                        <div key={k} className="rounded bg-muted/50 px-2 py-1">
                          <dt className="text-xs text-muted-foreground">{k}</dt>
                          <dd>{Array.isArray(v) ? v.join(", ") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                </details>
              )}
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">Page publique</p>
                {pro.submittedVersion ? (
                  <p>
                    Version {pro.submittedVersion.versionNumber} soumise le {dateTime(pro.submittedVersion.submittedAt)} (template {pro.submittedVersion.templateKey}).{" "}
                    <Link href={`/app/pro/${pro.id}/page/apercu?version=${pro.submittedVersion.id}`} className="underline" target="_blank">
                      Aperçu
                    </Link>
                  </p>
                ) : (
                  <p className="text-muted-foreground">Aucune version en attente.</p>
                )}
                {pro.publishedVersion && <p className="text-muted-foreground">Version publiée : n° {pro.publishedVersion.versionNumber}. Elle reste visible tant qu'une nouvelle version n'est pas approuvée.</p>}
              </div>
            </Card>
          )}

          {pro && (
            <Card className="gap-4 p-6">
              <h2 className="font-semibold">Vérifications</h2>
              <p className="text-xs text-muted-foreground">Chaque ligne indique précisément ce qui a été contrôlé. Le niveau public est recalculé automatiquement (identité, immatriculation, justificatifs, assurance, qualifications).</p>
              <ul className="divide-y text-sm">
                {VERIFICATION_KINDS.map((kind) => {
                  const row = pro.verifications.find((v) => v.kind === kind);
                  const meta = VERIFICATION_KIND_LABELS[kind];
                  return (
                    <li key={kind} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.meaning}</p>
                        </div>
                        <StatusBadge tone={row?.status === "verified" ? "success" : row?.status === "rejected" ? "danger" : row?.status === "pending" ? "warning" : "neutral"}>{row?.status ?? "non renseigné"}</StatusBadge>
                      </div>
                      {row?.statement && <p className="text-xs">« {row.statement} »{row.reviewedAt ? ` · ${dateTime(row.reviewedAt)}` : ""}</p>}
                      {canDecide && (
                        <details>
                          <summary className="cursor-pointer text-xs underline">Marquer vérifié / rejeté</summary>
                          <ActionForm action={reviewVerificationAction} successMessage="Vérification enregistrée." className="mt-2 space-y-2">
                            <input type="hidden" name="professionalId" value={pro.id} />
                            <input type="hidden" name="kind" value={kind} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <Label htmlFor={`st-${kind}`} className="text-xs">
                              Ce qui a été vérifié (obligatoire)
                            </Label>
                            <Textarea id={`st-${kind}`} name="statement" required minLength={15} rows={2} placeholder="Ex. : attestation RC Pro n° … valide jusqu'au …, examinée le …" />
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <Label htmlFor={`vu-${kind}`} className="text-xs">
                                  Valide jusqu'au
                                </Label>
                                <Input id={`vu-${kind}`} type="date" name="validUntil" />
                              </div>
                              <ActionSubmit size="sm" name="status" value="verified">
                                Vérifié
                              </ActionSubmit>
                              <ActionSubmit size="sm" variant="outline" name="status" value="rejected">
                                Rejeté
                              </ActionSubmit>
                            </div>
                          </ActionForm>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {pro && (
            <Card className="gap-4 p-6">
              <h2 className="font-semibold">Justificatifs ({pro.documents.length})</h2>
              {!canSeeDocs ? (
                <p className="text-sm text-muted-foreground">Accès réservé aux comptes disposant de la permission « moderation.documents.view ».</p>
              ) : pro.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun justificatif transmis.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {pro.documents.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{DOCUMENT_KIND_LABELS[doc.kind as DocumentKind]}{doc.label ? ` : ${doc.label}` : ""}</p>
                        <p className="text-xs text-muted-foreground">
                          Transmis le {dateTime(doc.createdAt)} · <StatusBadge tone={doc.status === "verified" ? "success" : doc.status === "rejected" ? "danger" : "warning"}>{doc.status}</StatusBadge>
                          {doc.reviewNote ? ` · ${doc.reviewNote}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={privateFileHref(doc.fileId)} className="text-sm underline" target="_blank" rel="noopener noreferrer">
                          Ouvrir
                        </a>
                        {canDecide && doc.status === "pending" && (
                          <ActionForm action={reviewDocumentAction} successMessage="Document traité." className="flex items-center gap-1 space-y-0">
                            <input type="hidden" name="documentId" value={doc.id} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <input type="hidden" name="professionalId" value={pro.id} />
                            <Input name="note" placeholder="Note" className="h-8 w-36" />
                            <ActionSubmit size="sm" name="status" value="verified">Conforme</ActionSubmit>
                            <ActionSubmit size="sm" variant="outline" name="status" value="rejected">Non conforme</ActionSubmit>
                          </ActionForm>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {detail.reports.length > 0 && (
            <Card className="gap-3 p-6">
              <h2 className="font-semibold">Signalements liés ({detail.reports.length})</h2>
              <ul className="divide-y text-sm">
                {detail.reports.map((r) => (
                  <li key={r.id} className="py-2">
                    <p className="font-medium">{r.reason}</p>
                    {r.details && <p className="text-muted-foreground">{r.details}</p>}
                    <p className="text-xs text-muted-foreground">{dateTime(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {detail.appeals.length > 0 && (
            <Card className="gap-3 p-6">
              <h2 className="font-semibold">Recours ({detail.appeals.length})</h2>
              <ul className="divide-y text-sm">
                {detail.appeals.map((a) => (
                  <li key={a.id} className="py-2">
                    <p className="whitespace-pre-wrap">{a.argument}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(a.createdAt)} · {a.status}
                      {a.decisionReason ? ` · ${a.decisionReason}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <Link href="/admin/signalements#recours" className="text-sm underline">
                Traiter les recours
              </Link>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canDecide ? (
            <Card className="gap-4 p-6">
              <h2 className="font-semibold">Décision</h2>
              <DecisionForm caseId={c.id} action={decideCaseAction} allowed={decisions} />
            </Card>
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">Lecture seule : votre rôle ne permet pas de décider.</Card>
          )}
          {canDecide && (
            <Card className="gap-3 p-6">
              <h2 className="font-semibold">Assignation</h2>
              <ActionForm action={assignCaseAction} successMessage="Assignation mise à jour." className="flex items-center gap-2 space-y-0">
                <input type="hidden" name="caseId" value={c.id} />
                <select name="assigneeUserId" defaultValue={c.assignedToUserId ?? "none"} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" aria-label="Assigner à">
                  <option value="none">Non assigné</option>
                  {moderators.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
                <ActionSubmit size="sm" variant="outline">
                  OK
                </ActionSubmit>
              </ActionForm>
            </Card>
          )}
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Historique des décisions</h2>
            {detail.decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune décision pour l'instant.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {detail.decisions.map((d) => (
                  <li key={d.id} className="rounded-lg border p-3">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-medium">{DECISION_LABELS[d.decision as Decision] ?? d.decision}</span>
                      <span className="text-xs text-muted-foreground">{dateTime(d.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{d.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">par {d.decidedByName}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
