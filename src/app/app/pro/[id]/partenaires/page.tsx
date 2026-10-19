import type { Metadata } from "next";
import Link from "next/link";
import { HoldActionButton } from "@/components/brief/hold-buttons";
import { ActionForm } from "@/components/professionals/action-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireActor } from "@/lib/session";
import { getOftenBookedWith, listMyRecommendations, MAX_RECOMMENDATIONS, searchPartnerCandidates } from "@/modules/professionals/application/recommendation-service";
import { addRecommendationAction, removeRecommendationAction } from "./actions";

export const metadata: Metadata = { title: "Partenaires" };

/** The professionals you work with, recommended on your public page. */
export default async function PartnersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q = "" } = await searchParams;
  const actor = await requireActor(`/app/pro/${id}/partenaires`);
  const [mine, candidates, often] = await Promise.all([listMyRecommendations(actor, id), searchPartnerCandidates(actor, id, q), getOftenBookedWith(id)]);
  return (
    <div className="space-y-8">
      <PageHeader title="Partenaires" description={`Recommandez les professionnels avec qui vous travaillez (${MAX_RECOMMENDATIONS} au plus). Ils apparaissent sur votre page publique, et ils sont prévenus.`} />
      <section aria-labelledby="mine-h" className="space-y-3">
        <h2 id="mine-h" className="text-lg font-semibold">
          Vos partenaires recommandés
        </h2>
        {mine.length === 0 ? (
          <EmptyState title="Aucun partenaire pour l'instant" description="Cherchez un professionnel par son nom ci-dessous pour l'ajouter." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card" data-testid="my-partners">
            {mine.map((p) => (
              <li key={p.recommendationId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <Link href={`/pro/${p.slug}`} className="font-medium hover:underline">
                    {p.displayName}
                  </Link>
                  <p className="text-muted-foreground">
                    {p.categoryName}
                    {p.city ? `, ${p.city}` : ""}
                    {p.note ? `. « ${p.note} »` : ""}
                  </p>
                </div>
                <HoldActionButton run={removeRecommendationAction.bind(null, id, p.recommendationId)} label="Retirer" done="Partenaire retiré." />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="add-h" className="space-y-3">
        <h2 id="add-h" className="text-lg font-semibold">
          Ajouter un partenaire
        </h2>
        <form className="flex flex-wrap items-end gap-2" role="search">
          <div className="space-y-1">
            <Label htmlFor="partner-q">Nom du professionnel</Label>
            <Input id="partner-q" name="q" defaultValue={q} minLength={2} className="w-64" />
          </div>
          <button type="submit" className="h-9 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 hover:bg-muted">
            Chercher
          </button>
        </form>
        {q.trim().length >= 2 &&
          (candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun professionnel publié ne correspond à « {q} ».</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Card className="gap-2 p-4">
                    <p className="font-medium">{c.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.categoryName}
                      {c.city ? `, ${c.city}` : ""}
                    </p>
                    <ActionForm action={addRecommendationAction} submitLabel="Recommander" successMessage={`${c.displayName} ajouté à vos partenaires.`} variant="outline">
                      <input type="hidden" name="professionalId" value={id} />
                      <input type="hidden" name="recommendedId" value={c.id} />
                      <Label htmlFor={`note-${c.id}`} className="text-xs">
                        Pourquoi vous le recommandez (facultatif)
                      </Label>
                      <Input id={`note-${c.id}`} name="note" maxLength={280} className="mt-1" />
                    </ActionForm>
                  </Card>
                </li>
              ))}
            </ul>
          ))}
      </section>
      {often.length > 0 && (
        <section aria-labelledby="often-h" className="space-y-2">
          <h2 id="often-h" className="text-lg font-semibold">
            Souvent réservés avec vous
          </h2>
          <p className="text-sm text-muted-foreground">Calculé sur les évènements où vous étiez confirmés ensemble, au moins deux fois.</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {often.map((o) => (
              <li key={o.id} className="rounded-full border px-3 py-1">
                {o.displayName}, {o.events} évènements
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
