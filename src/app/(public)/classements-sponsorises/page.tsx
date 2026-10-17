import type { Metadata } from "next";
import Link from "next/link";
import { EditorialContent } from "@/components/admin/editorial-content";
import { Container, Section } from "@/components/shared/section";
import { PageHeader } from "@/components/shared/page-header";
import { getSetting } from "@/modules/admin/application/settings-service";
import { getPublishedEditorialPage } from "@/modules/admin/application/editorial-service";
import { DRAFT_NOTICE } from "@/modules/legal/domain/defaults";

export const metadata: Metadata = { title: "Classements et résultats sponsorisés — Sous Nos Ailes", description: "Comment les résultats sont classés dans l'annuaire, ce qu'est un emplacement sponsorisé et ce qu'il ne garantit pas." };

/** Legal information on ranking and sponsored results (editable from the back-office; built-in text otherwise). */
export default async function SponsoredRankingsPage() {
  const [page, maxPerQuery] = await Promise.all([getPublishedEditorialPage("classements-sponsorises"), getSetting<number>("sponsored.max_per_query", 2)]);
  return (
    <Section>
      <Container size="narrow" className="space-y-8">
        <PageHeader eyebrow="Transparence" title={page?.title ?? "Classements et résultats sponsorisés"} description="Ce que signifie « Sponsorisé » dans l'annuaire, comment les résultats sont ordonnés et ce qu'un emplacement payant ne permet jamais." />
        {page ? (
          <>
            {page.hasDraftNotice && (
              <p role="note" className="rounded-lg border border-warning/50 bg-warning/15 px-4 py-3 text-sm">
                {DRAFT_NOTICE}
              </p>
            )}
            <EditorialContent blocks={page.blocks} />
          </>
        ) : (
          <div className="space-y-6 text-pretty leading-relaxed">
            <h2 className="text-xl font-semibold">Critères de classement par défaut</h2>
            <p>
              Les résultats de l'annuaire sont ordonnés par pertinence : correspondance avec le métier recherché, proximité géographique, disponibilité déclarée à la date de l'évènement, compatibilité avec le type d'évènement, complétude de la fiche, niveau de vérification et avis publiés. Aucun critère financier n'entre dans ce score.
            </p>
            <h2 className="text-xl font-semibold">Qu'est-ce qu'un résultat sponsorisé ?</h2>
            <p>
              Un professionnel disposant de l'offre Premium peut bénéficier d'un emplacement sponsorisé sur une catégorie et/ou un département, pour une durée définie. Ces résultats apparaissent en tête de liste, dans une zone distincte, et portent toujours l'étiquette <strong>« Sponsorisé »</strong>.
            </p>
            <h2 className="text-xl font-semibold">Limites</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Au plus {maxPerQuery} résultat{maxPerQuery > 1 ? "s" : ""} sponsorisé{maxPerQuery > 1 ? "s" : ""} par recherche.</li>
              <li>Seules les fiches publiées, donc passées par la modération, peuvent être sponsorisées. Un emplacement ne contourne jamais une vérification ni une suspension.</li>
              <li>Aucune position n'est garantie : l'affichage dépend des filtres de recherche et de la rotation entre professionnels éligibles.</li>
              <li>Le sponsoring n'influence ni les avis, ni le niveau de vérification, ni le score de pertinence des résultats organiques.</li>
            </ul>
            <h2 className="text-xl font-semibold">Mentions de vérification</h2>
            <p>Les badges de vérification décrivent précisément ce qui a été contrôlé par notre équipe (par exemple « Assurance vérifiée » signifie qu'une attestation en cours de validité a été examinée à la date indiquée). Ils ne constituent ni une certification officielle, ni une garantie sur la prestation.</p>
            <p className="text-sm text-muted-foreground">
              Pour toute question : voir nos{" "}
              <Link href="/cgu" className="underline">
                conditions d'utilisation
              </Link>{" "}
              et notre{" "}
              <Link href="/moderation" className="underline">
                politique de modération
              </Link>
              .
            </p>
          </div>
        )}
      </Container>
    </Section>
  );
}
