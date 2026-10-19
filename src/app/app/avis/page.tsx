import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FieldErrorText } from "@/components/professionals/action-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { listMyReviews, listReviewOpportunities } from "@/modules/professionals/application/review-service";
import { createReviewAction } from "./actions";

export const metadata: Metadata = { title: "Mes avis" };

const STATUS = { pending: ["En relecture", "warning"], published: ["Publié", "success"], rejected: ["Non publié", "danger"], hidden: ["Masqué", "neutral"] } as const;

function frDate(iso: string | null): string {
  if (!iso) return "";
  return formatDateFr(new Date(`${iso}T12:00:00Z`), { day: "numeric", month: "long", year: "numeric" }, "UTC");
}

/** Only professionals you really worked with through the platform, once the event is over. */
export default async function MyReviewsPage() {
  const actor = await requireActor("/app/avis");
  const [opportunities, mine] = await Promise.all([listReviewOpportunities(actor), listMyReviews(actor)]);
  return (
    <div className="space-y-8">
      <PageHeader title="Mes avis" description="Vous pouvez noter un professionnel avec qui vous avez travaillé sur la plateforme, une fois l'évènement passé. Votre avis est marqué comme vérifié et relu avant publication." />
      {opportunities.length === 0 ? (
        <EmptyState title="Aucune prestation à évaluer" description="Après votre évènement, les professionnels confirmés apparaissent ici pour que vous puissiez partager votre expérience." />
      ) : (
        <ul className="space-y-6" data-testid="review-opportunities">
          {opportunities.map((o) => (
            <li key={`${o.professionalId}:${o.eventId ?? o.inquiryId}`}>
              <Card className="p-5 sm:p-6">
                <h2 className="font-heading text-lg font-semibold">
                  <Link href={`/pro/${o.slug}`} className="hover:underline">
                    {o.professionalName}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {o.label}
                  {o.date ? `, ${frDate(o.date)}` : ""}
                </p>
                <ActionForm action={createReviewAction} submitLabel="Publier mon avis" successMessage="Merci, votre avis sera publié après relecture." className="mt-4">
                  <input type="hidden" name="professionalId" value={o.professionalId} />
                  <input type="hidden" name="eventId" value={o.eventId ?? ""} />
                  <input type="hidden" name="inquiryId" value={o.inquiryId ?? ""} />
                  <fieldset>
                    <legend className="text-sm font-medium">Votre note</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <label key={n} className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                          <input type="radio" name="rating" value={n} className="sr-only" required />
                          {n} sur 5
                        </label>
                      ))}
                    </div>
                    <FieldErrorText name="rating" />
                  </fieldset>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`title-${o.professionalId}`}>Titre (facultatif)</Label>
                    <Input id={`title-${o.professionalId}`} name="title" maxLength={120} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`body-${o.professionalId}`}>Votre expérience</Label>
                    <Textarea id={`body-${o.professionalId}`} name="body" rows={4} maxLength={2000} required placeholder="Ce qui s'est bien passé, ce qui aurait pu être mieux, pour qui vous le recommandez." />
                    <FieldErrorText name="body" />
                  </div>
                </ActionForm>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {mine.length > 0 && (
        <section aria-labelledby="mine-h" className="space-y-3">
          <h2 id="mine-h" className="text-lg font-semibold">
            Avis déjà donnés
          </h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {mine.map((r) => {
              const [label, tone] = STATUS[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <Link href={`/pro/${r.slug}`} className="font-medium hover:underline">
                      {r.professionalName}
                    </Link>
                    <span className="text-muted-foreground">, {r.rating} sur 5, le {formatDateFr(r.createdAt)}</span>
                  </span>
                  <StatusBadge tone={tone}>{label}</StatusBadge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
