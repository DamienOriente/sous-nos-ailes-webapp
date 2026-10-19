import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { moderationCases } from "@/db/schema";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { canGlobal } from "@/modules/authorization";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { CASE_KIND_LABELS, CASE_STATUS_LABELS } from "@/modules/moderation/domain/decisions";
import { getProfessionalForModeration } from "@/modules/moderation/application/moderation-service";
import { STATUS_LABELS, STATUS_TONES, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { DOCUMENT_KIND_LABELS, VERIFICATION_KIND_LABELS, verificationLevelLabel, type DocumentKind, type VerificationKind } from "@/modules/professionals/domain/verification";
import { requireAdminPage } from "../../_lib/admin-page";
import { directDecisionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProfessionalAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, twoFactorWarning } = await requireAdminPage("moderation.queue", `/admin/professionnels/${id}`);
  const pro = await getProfessionalForModeration(id);
  if (!pro) notFound();
  const cases = await db.select().from(moderationCases).where(eq(moderationCases.professionalId, id)).orderBy(desc(moderationCases.createdAt)).limit(20);
  const openCase = (await db.select({ id: moderationCases.id }).from(moderationCases).where(and(eq(moderationCases.professionalId, id), inArray(moderationCases.status, ["open", "in_review"]))).limit(1))[0];
  const canDecide = canGlobal(actor, "moderation.decide");
  const status = pro.status as ProfessionalStatus;
  return (
    <div className="space-y-6">
      <Link href="/admin/professionnels" className="text-sm text-muted-foreground hover:underline">Retour aux professionnels</Link>
      <PageHeader
        title={pro.displayName}
        description={`${pro.categoryName} · ${[pro.city, pro.department].filter(Boolean).join(", ") || "Non renseignée"} · propriétaire ${pro.ownerName} (${pro.ownerEmail})`}
        actions={
          <>
            <StatusBadge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</StatusBadge>
            {openCase && (
              <Link href={`/admin/moderation/${openCase.id}`} className="text-sm underline">
                Cas ouvert
              </Link>
            )}
            {status === "published" && (
              <Link href={`/pro/${pro.slug}`} className="text-sm underline" target="_blank">
                Page publique
              </Link>
            )}
          </>
        }
      />
      <TwoFactorBanner show={twoFactorWarning} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Fiche (lecture)</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Slug</dt><dd>{pro.slug}</dd></div>
              <div><dt className="text-muted-foreground">Complétude</dt><dd>{pro.completenessScore} %</dd></div>
              <div><dt className="text-muted-foreground">Niveau de vérification</dt><dd>{pro.verificationLevel} : {verificationLevelLabel(pro.verificationLevel)}</dd></div>
              <div><dt className="text-muted-foreground">Avis</dt><dd>{pro.reviewCount} avis{pro.averageRating ? ` · ${pro.averageRating.toFixed(1)}/5` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Publiée le</dt><dd>{dateTime(pro.publishedAt)}</dd></div>
              <div><dt className="text-muted-foreground">Motif du statut</dt><dd>{pro.statusReason ?? "Non renseigné"}</dd></div>
            </dl>
            {pro.tagline && <p className="font-medium">{pro.tagline}</p>}
            {pro.description && <p className="whitespace-pre-wrap text-sm">{pro.description}</p>}
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Vérifications</h2>
            <ul className="divide-y text-sm">
              {pro.verifications.length === 0 && <li className="py-2 text-muted-foreground">Aucune vérification enregistrée.</li>}
              {pro.verifications.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{VERIFICATION_KIND_LABELS[v.kind as VerificationKind]?.label ?? v.kind}{v.statement ? <span className="block text-xs text-muted-foreground">« {v.statement} »</span> : null}</span>
                  <StatusBadge tone={v.status === "verified" ? "success" : v.status === "rejected" ? "danger" : "warning"}>{v.status}{v.reviewedAt ? ` · ${dateTime(v.reviewedAt)}` : ""}</StatusBadge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Pour modifier une vérification, passez par le cas de modération (motif obligatoire).</p>
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Justificatifs ({pro.documents.length})</h2>
            {!canGlobal(actor, "moderation.documents.view") ? <p className="text-sm text-muted-foreground">Accès réservé.</p> : (
              <ul className="divide-y text-sm">
                {pro.documents.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{DOCUMENT_KIND_LABELS[doc.kind as DocumentKind]}{doc.label ? ` : ${doc.label}` : ""} · {doc.status}</span>
                    <a href={privateFileHref(doc.fileId)} className="underline" target="_blank" rel="noopener noreferrer">Ouvrir</a>
                  </li>
                ))}
                {pro.documents.length === 0 && <li className="py-2 text-muted-foreground">Aucun justificatif.</li>}
              </ul>
            )}
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Historique des cas</h2>
            {cases.length === 0 ? <p className="text-sm text-muted-foreground">Aucun cas.</p> : (
              <ul className="divide-y text-sm">
                {cases.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/moderation/${c.id}`} className="underline">{CASE_KIND_LABELS[c.kind] ?? c.kind}</Link>
                    <span className="text-muted-foreground">{CASE_STATUS_LABELS[c.status]} · {dateTime(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {canDecide && (
            <Card className="gap-3 p-6">
              <h2 className="font-semibold">Décision directe</h2>
              <p className="text-xs text-muted-foreground">Ouvre un cas et l'historise comme une décision de la file. Le professionnel est notifié avec le motif.</p>
              <ActionForm action={directDecisionAction} successMessage="Décision enregistrée." resetOnSuccess>
                <input type="hidden" name="professionalId" value={pro.id} />
                <Textarea name="reason" required minLength={10} rows={3} placeholder="Motif (obligatoire, transmis au professionnel)" aria-label="Motif" />
                <div className="flex flex-wrap gap-2">
                  {status === "published" && <ActionSubmit variant="destructive" name="decision" value="suspend">Suspendre</ActionSubmit>}
                  {status === "published" && <ActionSubmit variant="outline" name="decision" value="request_changes">Demander des modifications</ActionSubmit>}
                  {status === "suspended" && <ActionSubmit name="decision" value="reinstate">Rétablir</ActionSubmit>}
                  {(status === "pending_review" || status === "changes_requested" || status === "approved") && <ActionSubmit name="decision" value="approve">Approuver et publier</ActionSubmit>}
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
