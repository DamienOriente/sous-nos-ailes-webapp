import type { Metadata } from "next";
import Link from "next/link";
import { ProfessionalCard } from "@/components/directory/professional-card";
import { CameraScene } from "@/components/illustrations";
import { InquiryExample } from "@/components/marketing/mockups";
import { DemoLabel, PhotoFrame } from "@/components/marketing/photo-frame";
import { Container, Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { formatEuros } from "@/lib/utils";
import { PLAN_SEED } from "@/modules/billing/domain/plans";
import { listFeaturedProfessionals } from "@/modules/directory/application/public-showcase";
import { showcasePhoto } from "@/modules/media/demo-photos";
import { VERIFICATION_KIND_LABELS, VERIFICATION_KINDS } from "@/modules/professionals/domain/verification";

export const metadata: Metadata = {
  title: "Publier votre fiche professionnelle",
  description: "Fiche gratuite dans l'annuaire, page publique, demandes de devis détaillées, calendrier et outils métier pour les professionnels de la garde d'enfants et de l'évènementiel.",
  alternates: { canonical: new URL("/professionnels", env.APP_URL).toString() },
};

const BENEFITS = [
  { title: "Une fiche et une page publique", text: "Votre fiche apparaît dans l'annuaire. Vous pouvez aussi composer une page personnelle à partir de modèles pensés pour votre métier. Une personne de l'équipe relit le tout avant publication." },
  { title: "Des demandes avec leur contexte", text: "La date, la ville, le nombre d'invités et d'enfants arrivent avec la demande. Vous répondez depuis votre espace, par e-mail au demandeur." },
  { title: "Un calendrier", text: "Grille hebdomadaire et indisponibilités. Quand un organisateur filtre par date, l'annuaire tient compte de vos créneaux. La synchronisation Google et Outlook fait partie de l'offre Premium." },
  { title: "Des outils selon le métier", text: "Liste des enfants, présences et remises pour la garde d'enfants. Brief musical, plan de service, espaces et logistique pour les autres métiers. Vous activez ceux qui vous servent." },
  { title: "Un classement lisible", text: "L'ordre des résultats tient compte du métier, de la proximité, de la disponibilité, de la fiche complète et des vérifications. Les emplacements sponsorisés sont séparés et étiquetés, et ne passent jamais devant sans l'indiquer." },
];

const ONBOARDING = [
  { title: "Votre métier", text: "Choisissez votre métier principal et, si besoin, un ou deux métiers secondaires." },
  { title: "Votre structure", text: "Nom commercial, statut, ville et rayon d'intervention. Le SIRET sert à la vérification, il n'est pas publié." },
  { title: "Votre activité", text: "Pour la garde d'enfants : tranches d'âge, ratio d'encadrement déclaré, expérience. Pour les autres métiers : prestations et capacités." },
  { title: "Votre fiche", text: "Accroche, description, fourchette de prix, types d'évènements, photos. Tout est enregistré au fur et à mesure." },
  { title: "Relecture", text: "Un membre de l'équipe relit la fiche sous 48 h ouvrées, puis elle est publiée dans l'annuaire." },
];

const PREMIUM_PRICE = formatEuros(PLAN_SEED.find((p) => p.key === "professional_premium")?.priceMonthlyCents ?? 0);

export default async function ProfessionalsLandingPage() {
  const featured = await listFeaturedProfessionals(2).catch(() => []);
  const hero = showcasePhoto("professionalsHero");
  return (
    <>
      <Section>
        <Container size="wide" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div>
            <h1 className="font-heading text-4xl font-semibold text-balance sm:text-5xl">Publiez votre fiche et recevez des demandes de devis détaillées</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground text-pretty">
              Garde d'enfants, animation, lieux, traiteurs, DJ, photographes : les organisateurs cherchent par métier, ville et date. La fiche est gratuite, et relue par une personne de l'équipe avant publication.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/inscription?intent=professional">Créer ma fiche gratuitement</Link>
              </Button>
              <Link href="#verification" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Comment fonctionnent les vérifications
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Sans engagement. L'offre Premium ({PREMIUM_PRICE} TTC par mois) ajoute les modèles de page complets, les statistiques et la synchronisation d'agenda.</p>
          </div>
          <PhotoFrame photo={hero} corner="tl" priority width={1200} height={900} sizes="(max-width: 1024px) 100vw, 560px" caption="Photo de démonstration" alt="Photographe cadrant avec son boîtier, photo de démonstration" />
        </Container>
      </Section>

      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="wide" className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <div>
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Votre fiche en cinq étapes</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Comptez une dizaine de minutes. Chaque étape est enregistrée, vous pouvez vous arrêter et reprendre plus tard.</p>
          </div>
          <ol className="divide-y">
            {ONBOARDING.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5 first:pt-0 last:pb-0">
                <span className="font-heading text-3xl leading-none text-primary tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 leading-7 text-muted-foreground text-pretty">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container size="wide" className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div>
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Des fiches comme la vôtre</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Voici comment une fiche apparaît dans les résultats de l'annuaire : le métier, la ville, les prestations, la fourchette de prix, le niveau de vérification.</p>
            {featured.some((p) => p.isDemo) && (
              <p className="mt-3">
                <DemoLabel>Fiches de démonstration, professionnels fictifs</DemoLabel>
              </p>
            )}
            {featured.length > 0 ? (
              <ul className="mt-8 grid gap-6 sm:grid-cols-2">
                {featured.map((p) => (
                  <li key={p.id}>
                    <ProfessionalCard professional={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 rounded-3xl bg-ivory-deep/70 p-6 dark:bg-ivory-deep/50">
                <CameraScene className="mx-auto max-w-xs" />
                <p className="mt-2 text-center text-sm text-muted-foreground">Aucune fiche publiée pour l'instant : la vôtre pourrait être la première.</p>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Les demandes que vous recevez</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Un organisateur remplit quelques champs depuis votre fiche. Vous recevez une demande complète, à laquelle vous répondez par e-mail depuis votre espace.</p>
            <InquiryExample className="mt-8" professionalName={featured[0]?.displayName} categoryName={featured[0]?.categoryName} />
          </div>
        </Container>
      </Section>

      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="wide">
          <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Ce que la plateforme vous apporte</h2>
          <dl className="mt-8 divide-y border-y">
            {BENEFITS.map((b) => (
              <div key={b.title} className="grid gap-1 py-5 sm:grid-cols-[18rem_1fr] sm:gap-8">
                <dt className="text-lg font-semibold">{b.title}</dt>
                <dd className="leading-7 text-muted-foreground text-pretty">{b.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm">
            <Link href="/classements-sponsorises" className="font-medium text-primary underline-offset-4 hover:underline">
              Comprendre le classement et les résultats sponsorisés
            </Link>
          </p>
        </Container>
      </Section>

      <Section id="verification">
        <Container size="wide" className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <div>
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Ce que nous vérifions, et ce que nous ne promettons pas</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">
              Chaque niveau correspond à un contrôle précis, fait sur pièces par notre équipe. Nous ne délivrons ni label ni certification et nous ne garantissons pas la qualité d'une prestation : nous indiquons ce qui a été vérifié.
            </p>
          </div>
          <div>
            <ol className="divide-y">
              {VERIFICATION_KINDS.map((k, i) => (
                <li key={k} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5 first:pt-0">
                  <span className="font-heading text-3xl leading-none text-primary tabular-nums" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{VERIFICATION_KIND_LABELS[k].label}</h3>
                    <p className="mt-1 leading-7 text-muted-foreground text-pretty">{VERIFICATION_KIND_LABELS[k].meaning}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 border-t pt-5 leading-7 text-muted-foreground text-pretty">
              Les justificatifs que vous transmettez (Kbis, attestation d'assurance, diplômes) ne sont lus que par l'équipe de modération. Ils ne sont jamais publiés ni envoyés par e-mail, et vous pouvez les retirer tant qu'ils n'ont pas été examinés.
            </p>
          </div>
        </Container>
      </Section>

      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="narrow" className="text-center">
          <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Rejoindre l'annuaire</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground text-pretty">Cinq étapes, enregistrées au fur et à mesure. Votre fiche est relue sous 48 h ouvrées.</p>
          <Button asChild size="lg" className="mt-8 rounded-full px-6">
            <Link href="/inscription?intent=professional">Créer ma fiche</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}
