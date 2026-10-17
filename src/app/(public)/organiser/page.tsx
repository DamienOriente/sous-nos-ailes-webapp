import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProfessionalCard } from "@/components/directory/professional-card";
import { CalendarScene, KidsCornerScene } from "@/components/illustrations";
import { SearchScene, TeamScene } from "@/components/illustrations/public-scenes";
import { ControlTowerMockup, InquiryExample, KidsSpaceMockup, ProvidersMockup, SeatingPlanMockup } from "@/components/marketing/mockups";
import { DemoLabel, PhotoFrame } from "@/components/marketing/photo-frame";
import { Container, Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { getDemoEventShowcase, listFeaturedProfessionals } from "@/modules/directory/application/public-showcase";
import { showcasePhoto } from "@/modules/media/demo-photos";

export const metadata: Metadata = {
  title: "Organiser un évènement",
  description: "Le parcours d'un organisateur sur Sous Nos Ailes : trouver les professionnels, réunir l'équipe, préparer et vivre le jour J, enfants compris.",
  alternates: { canonical: "/organiser" },
};

const STAGES = [
  {
    step: 1,
    title: "Avant : trouver et comparer",
    Scene: SearchScene,
    photo: showcasePhoto("organiserBefore"),
    items: [
      "Cherchez par métier et par zone dans l'annuaire ; la garde d'enfants est en tête, les autres métiers suivent.",
      "Chaque fiche indique ce qui a été vérifié, le périmètre d'intervention et une fourchette de prix quand le professionnel l'a renseignée.",
      "Envoyez une demande de contact, de disponibilité ou de devis. Les réponses arrivent dans votre espace et par e-mail.",
    ],
  },
  {
    step: 2,
    title: "Pendant la préparation : réunir l'équipe",
    Scene: TeamScene,
    photo: showcasePhoto("organiserDuring"),
    items: [
      "Créez l'évènement (mariage, baptême, anniversaire, séminaire…) : une liste de tâches adaptée au type d'évènement est proposée.",
      "Invitez coorganisateurs, wedding planner et prestataires avec un lien sécurisé. Chacun obtient un rôle et ne voit que ce qui le concerne.",
      "Suivez le budget, les devis et les documents ; échangez dans des canaux par sujet ; partagez le planning du jour J.",
      "Si des enfants sont présents, inscrivez-les avec les consignes des parents : l'équipe de garde disposera d'un espace dédié et sécurisé.",
    ],
  },
  {
    step: 3,
    title: "Le jour J : vivre la fête",
    Scene: KidsCornerScene,
    photo: showcasePhoto("organiserDay"),
    items: [
      "Accueillez les invités au QR code (gratuit en version simple, personnalisé avec l'offre Plus) et suivez les présences.",
      "L'équipe de garde enregistre arrivées, départs et remises aux personnes autorisées ; vous avez la vue d'ensemble.",
      "Après l'évènement, archivez : les données des enfants sont anonymisées automatiquement.",
    ],
  },
] as const;

export default async function OrganizerPage() {
  const [showcase, featured] = await Promise.all([getDemoEventShowcase().catch(() => null), listFeaturedProfessionals(1).catch(() => [])]);
  const example = featured[0];
  const hero = showcasePhoto("organiserHero");
  return (
    <>
      <Section className="pb-10 sm:pb-10 lg:pb-10">
        <Container size="wide" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div>
            <p className="text-base text-muted-foreground">Pour les organisateurs</p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">Préparer un évènement sans tout porter seul</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground text-pretty">
              Sous Nos Ailes réunit vos professionnels, votre équipe et vos invités au même endroit. Voici concrètement ce qui se passe, de la première recherche au lendemain de la fête.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/inscription?intent=organizer">Créer mon espace gratuitement</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-5">
                <Link href="/annuaire/garde-enfants-evenementielle">Voir les professionnels de la garde d'enfants</Link>
              </Button>
            </div>
          </div>
          <PhotoFrame photo={hero} corner="tr" priority width={1200} height={900} sizes="(max-width: 1024px) 100vw, 560px" caption="Photo de démonstration" alt="Mariés entourés de leurs invités — photo de démonstration" />
        </Container>
      </Section>

      <Section className="pt-6 sm:pt-6 lg:pt-6">
        <Container size="wide">
          <ol className="space-y-16">
            {STAGES.map((j, i) => (
              <li key={j.step} className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                <div className="relative">
                  <PhotoFrame photo={j.photo} corner={i % 2 ? "br" : "bl"} width={1200} height={900} sizes="(max-width: 1024px) 100vw, 50vw" caption="Photo de démonstration" />
                  <div className="absolute -top-6 right-4 w-36 rounded-3xl bg-card p-2 shadow-soft sm:w-44">
                    <j.Scene />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Étape {j.step}</p>
                  <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{j.title}</h2>
                  <ul className="mt-4 space-y-3 leading-7 text-muted-foreground">
                    {j.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span className="text-pretty">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {showcase && (
        <Section id="espace-organisateur" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
          <Container size="wide">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Ce que vous voyez dans votre espace</h2>
              <p className="mt-3 text-lg text-muted-foreground text-pretty">Quatre écrans de l'évènement {showcase.isDemo ? "de démonstration" : ""} « {showcase.name} », tels qu'ils s'affichent pour l'organisateur. Les chiffres sont lus dans la base, pas dessinés.</p>
              {showcase.isDemo && (
                <p className="mt-3">
                  <DemoLabel>Évènement fictif, personnes fictives</DemoLabel>
                </p>
              )}
            </div>
            <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
              <ControlTowerMockup event={showcase} />
              <div className="min-w-0 space-y-5">
                <ProvidersMockup event={showcase} />
                <KidsSpaceMockup event={showcase} />
              </div>
              <SeatingPlanMockup event={showcase} className="lg:col-span-2" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Le plan de table, les QR codes personnalisés et les exports font partie de l'offre Organisateur Plus.</p>
          </Container>
        </Section>
      )}

      <Section id="demander-un-devis">
        <Container size="wide" className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div>
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Une demande de devis, concrètement</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Depuis une fiche, vous décrivez votre évènement en cinq champs. Le professionnel reçoit tout ce qu'il lui faut pour répondre vite et juste.</p>
            <InquiryExample className="mt-6" professionalName={example?.displayName} categoryName={example?.categoryName} />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">La fiche telle que vous la voyez</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Métier, zone, prestations, fourchette de prix et niveau de vérification détaillé au survol.</p>
            {example ? (
              <div className="mt-6 max-w-sm">
                <ProfessionalCard professional={example} />
                {example.isDemo && (
                  <p className="mt-2">
                    <DemoLabel>Fiche de démonstration</DemoLabel>
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl bg-ivory-deep/70 p-6 dark:bg-ivory-deep/50">
                <CalendarScene className="mx-auto max-w-xs" />
                <p className="mt-2 text-center text-sm text-muted-foreground">Aucune fiche publiée pour l'instant.</p>
              </div>
            )}
          </div>
        </Container>
      </Section>

      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="wide" className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="text-xl font-semibold">Ce qui est gratuit</h2>
            <p className="mt-2 leading-7 text-muted-foreground text-pretty">Jusqu'à trois évènements, l'annuaire, les demandes, les tâches, le planning, 50 contacts et 60 invitations essentielles.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Ce qu'ajoute Organisateur Plus</h2>
            <p className="mt-2 leading-7 text-muted-foreground text-pretty">Plan de table, invitations personnalisées et QR codes, budget avancé, exports PDF et CSV, collaboration étendue. 9,90 € TTC par mois, sans engagement.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Ce qui reste entre vous et vos prestataires</h2>
            <p className="mt-2 leading-7 text-muted-foreground text-pretty">Le contrat, le prix et le paiement de chaque prestation. Nous ne sommes ni intermédiaire de paiement ni employeur.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:col-span-3">
            <Button asChild size="lg" className="rounded-full px-5">
              <Link href="/inscription?intent=organizer">Créer mon espace gratuitement</Link>
            </Button>
            <Link href="/tarifs" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Comparer les offres
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
