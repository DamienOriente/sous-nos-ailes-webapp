import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionForm, FieldErrorText } from "@/components/professionals/action-form";
import { DocumentUploader } from "@/components/professionals/document-uploader";
import { VerificationBadge } from "@/components/directory/verification-badge";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { getManagedListing } from "@/modules/professionals/application/professional-service";
import { getVerificationOverview } from "@/modules/professionals/application/verification-service";
import { DOCUMENT_KIND_LABELS, verifiedStatements, type VerificationKind, type VerificationStatus } from "@/modules/professionals/domain/verification";
import { attachDocumentAction, declareVerificationAction, removeDocumentAction } from "./actions";

export const metadata: Metadata = { title: "Vérification" };

const STATUS_LABEL: Record<VerificationStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  pending: { label: "En attente d'examen", tone: "warning" },
  verified: { label: "Vérifié", tone: "success" },
  rejected: { label: "Non retenu", tone: "danger" },
  expired: { label: "Expiré", tone: "neutral" },
};

export default async function VerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/verification`);
  const { listing } = await getManagedListing(actor, id);
  const { kinds, documents } = await getVerificationOverview(actor, id);
  const statements = verifiedStatements(kinds.filter((k) => k.status).map((k) => ({ kind: k.kind as VerificationKind, status: k.status as VerificationStatus, validUntil: k.validUntil })));
  return (
    <div className="space-y-8">
      <PageHeader
        title="Vérification"
        description="Ce que la plateforme a contrôlé, et ce qu'il reste à transmettre. Chaque mention publique décrit précisément le contrôle effectué : nous ne délivrons aucune certification."
        actions={<VerificationBadge level={listing.verificationLevel} statements={statements} size="md" />}
      />

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Niveaux de vérification</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {kinds.map((k) => (
            <li key={k.kind}>
              <Card className="h-full gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{k.label}</p>
                  {k.status ? <StatusBadge tone={STATUS_LABEL[k.status as VerificationStatus].tone}>{STATUS_LABEL[k.status as VerificationStatus].label}</StatusBadge> : <StatusBadge tone="neutral">Non renseigné</StatusBadge>}
                </div>
                <p className="text-sm text-muted-foreground">{k.meaning}</p>
                {k.statement && k.status === "verified" && <p className="text-xs">« {k.statement} »</p>}
                {k.reviewedAt && k.status === "verified" && (
                  <p className="text-xs text-muted-foreground">
                    Contrôlé le {formatDateFr(k.reviewedAt)}
                    {k.validUntil ? ` · valable jusqu'au ${formatDateFr(k.validUntil)}` : ""}
                  </p>
                )}
                {k.documentKind && <p className="text-xs text-muted-foreground">Justificatif attendu : {DOCUMENT_KIND_LABELS[k.documentKind]}</p>}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Déclarer une assurance ou une qualification</CardTitle>
            <CardDescription>Déclaratif : affiché comme « déclaré » tant que le justificatif n'a pas été examiné.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={declareVerificationAction} submitLabel="Enregistrer la déclaration" successMessage="Déclaration enregistrée.">
              <input type="hidden" name="professionalId" value={id} />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="decl-kind">Nature</Label>
                  <select id="decl-kind" name="kind" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" defaultValue="insurance_declared">
                    <option value="insurance_declared">Assurance responsabilité civile professionnelle</option>
                    <option value="qualification_declared">Diplôme ou formation</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="decl-statement">Précisions</Label>
                  <Textarea id="decl-statement" name="statement" rows={3} maxLength={500} placeholder="Ex. RC Pro souscrite auprès de (assureur), valable jusqu'au (date) / CAP AEPE obtenu en 2019, PSC1 2024" required />
                  <FieldErrorText name="statement" />
                </div>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Justificatifs transmis</CardTitle>
            <CardDescription>Lus uniquement par l'équipe de modération. Jamais affichés publiquement, jamais envoyés par e-mail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DocumentUploader professionalId={id} onAttach={attachDocumentAction} />
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun justificatif pour le moment.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.label ?? DOCUMENT_KIND_LABELS[d.kind]}</p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_KIND_LABELS[d.kind]} · transmis le {formatDateFr(d.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tone={STATUS_LABEL[d.status].tone}>{STATUS_LABEL[d.status].label}</StatusBadge>
                      {d.status === "pending" && (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Retirer ce justificatif">
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          }
                          title="Retirer ce justificatif ?"
                          description="Il ne sera pas examiné. Vous pourrez en transmettre un autre."
                          confirmLabel="Retirer"
                          onConfirm={removeDocumentAction.bind(null, id, d.id)}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
