import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { IllustratedEmpty } from "@/components/pages/workspace/illustrated-empty";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionForm, FieldErrorText } from "@/components/professionals/action-form";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { listReviewsForManage } from "@/modules/professionals/application/review-service";
import { replyReviewAction, reportReviewAction } from "./actions";

export const metadata: Metadata = { title: "Avis" };

const REVIEW_STATUS = { pending: { label: "En modération", tone: "warning" }, published: { label: "Publié", tone: "success" }, rejected: { label: "Refusé", tone: "danger" }, hidden: { label: "Masqué", tone: "neutral" } } as const;

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/avis`);
  const reviews = await listReviewsForManage(actor, id);
  return (
    <div className="space-y-6">
      <PageHeader title="Avis" description="Les avis proviennent d'organisateurs ayant échangé avec vous via la plateforme. Vous pouvez répondre une fois à chaque avis publié, ou le signaler à la modération." />
      {reviews.length === 0 ? (
        <IllustratedEmpty title="Aucun avis pour le moment" description="Après une prestation confirmée via la plateforme, l'organisateur peut laisser un avis depuis son évènement ; il est relu avant publication. Les avis ne peuvent pas être saisis à la main, c'est ce qui leur donne leur valeur.">
          <p className="mt-3 text-sm text-muted-foreground">Un bon réflexe : à la fin de chaque prestation, dites à l'organisateur qu'il peut laisser un avis depuis son espace « Prestataires ».</p>
        </IllustratedEmpty>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => {
            const st = REVIEW_STATUS[r.status];
            return (
              <li key={r.id}>
                <Card className="gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{r.rating}/5</span>
                        <span className="text-sm font-medium">{r.authorName.split(/\s+/)[0]}</span>
                        <span className="text-xs text-muted-foreground">· {formatDateFr(r.createdAt)}</span>
                      </div>
                      {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                    </div>
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                  {r.replyBody ? (
                    <div className="rounded-xl bg-muted/50 p-4 text-sm">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">Votre réponse{r.repliedAt ? ` · ${formatDateFr(r.repliedAt)}` : ""}</p>
                      <p className="whitespace-pre-wrap">{r.replyBody}</p>
                    </div>
                  ) : r.status === "published" ? (
                    <details className="rounded-xl border p-4">
                      <summary className="cursor-pointer text-sm font-medium">Répondre publiquement (une seule fois)</summary>
                      <ActionForm action={replyReviewAction} submitLabel="Publier ma réponse" successMessage="Réponse publiée." className="mt-3">
                        <input type="hidden" name="professionalId" value={id} />
                        <input type="hidden" name="reviewId" value={r.id} />
                        <div className="space-y-2">
                          <Label htmlFor={`reply-${r.id}`}>Réponse</Label>
                          <Textarea id={`reply-${r.id}`} name="replyBody" rows={4} maxLength={1000} required />
                          <FieldErrorText name="replyBody" />
                        </div>
                      </ActionForm>
                    </details>
                  ) : null}
                  {r.status === "published" && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">Signaler cet avis à la modération</summary>
                      <ActionForm action={reportReviewAction} submitLabel="Signaler" variant="outline" successMessage="Signalement transmis à la modération." className="mt-3 rounded-xl border p-4">
                        <input type="hidden" name="professionalId" value={id} />
                        <input type="hidden" name="reviewId" value={r.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`reason-${r.id}`}>Motif</Label>
                            <select id={`reason-${r.id}`} name="reason" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" defaultValue="inappropriate">
                              <option value="inappropriate">Contenu inapproprié</option>
                              <option value="fake_review">Avis que je pense infondé</option>
                              <option value="spam">Spam</option>
                              <option value="other">Autre</option>
                            </select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor={`details-${r.id}`}>Explications</Label>
                            <Textarea id={`details-${r.id}`} name="details" rows={3} maxLength={1000} />
                          </div>
                        </div>
                      </ActionForm>
                    </details>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
