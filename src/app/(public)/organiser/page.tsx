import type { Metadata } from "next";
import Link from "next/link";
import { ProfessionalCard } from "@/components/directory/professional-card";
import { CalendarScene } from "@/components/illustrations";
import { ControlTowerMockup, InquiryExample, KidsSpaceMockup, ProvidersMockup, SeatingPlanMockup } from "@/components/marketing/mockups";
import { DemoLabel, PhotoFrame } from "@/components/marketing/photo-frame";
import { Container, Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/lib/utils";
import { PLAN_SEED } from "@/modules/billing/domain/plans";
import { getDemoEventShowcase, listFeaturedProfessionals } from "@/modules/directory/application/public-showcase";
import { showcasePhoto } from "@/modules/media/demo-photos";

export const metadata: Metadata = {
  title: "Organiser un évènement",
  description: "Le parcours d'un organisateur sur Sous Nos Ailes : trouver les professionnels, réunir l'équipe, préparer le jour J, enfants compris.",
  alternates: { canonical: "/organiser" },
};

const STAGES = [
  {
    title: "Avant : trouver et comparer",
    photo: showcasePhoto("organiserBefore"),
    items: [
      "Cherchez par métier, ville et date dans l'annuaire. La garde d'enfants passe en premier.",
      "Chaque fiche indique ce qui a été vérifié, la zone d'intervention et une fourchette de prix quand le professionnel l'a renseignée.",
      "Envoyez une demande de contact, de disponibilité ou de devis. Les réponses arrivent dans votre espace et par e-mail.",
    ],
  },
  {
    title: "Pendant la préparation : réunir l'équipe",
    photo: showcasePhoto("organiserDuring"),
    items: [
      "Créez l'évènement (mariage, baptême, anniversaire, séminaire) : une liste de tâches adaptée au type d'évènement est proposée.",
      "Invitez coorganisateurs, wedding planner et prestataires avec un lien sécurisé. Chacun a un rôle et ne voit que ce qui le concerne.",
      "Suivez le budget, les devis et les documents, échangez par canaux de discussion, partagez le planning du jour J.",
      "Si des enfants viennent, inscrivez-les avec les consignes des parents. L'équipe de garde dispose d'un espace réservé.",
    ],
  },
  {
    title: "Le jour J : accueillir et suivre",
    photo: showcasePhoto("organiserDay"),
    items: [
      "Accueillez les invités avec un QR code (version simple gratuite, personnalisée avec l'offre Plus) et suivez les présences.",
      "L'équipe de garde note les arrivées, les départs et les remises aux personnes autorisées. Vous gardez la vue d'ensemble.",
      "Après l'évènement, archivez. Les données des enfants sont anonymisées automatiquement.",
    ],
  },
] as const;

const PLUS_PRICE = formatEuros(PLAN_SEED.find((p) => p.key === "organizer_plus")?.priceMonthlyCents ?? 0);
const FREE_EVENTS = PLAN_SEED.find((p) => p.key === "organizer_free")?.features["events.create"]?.limit;
const FREE_CONTACTS = PLAN_SEED.find((p) => p.key === "organizer_free")?.features.contacts?.limit;
const FREE_INVITATIONS = PLAN_SEED.find((p) => p.key === "organizer_free")?.features["invitations.basic"]?.limit;

export default async function OrganizerPage() {
  const [showcase, featured] = await Promise.all([getDemoEventShowcase().catch(() => null), listFeaturedProfessionals(1).catch(() => [])]);
  const example = featured[0];
  const hero = showcasePhoto("organiserHero");
  return (
    <>
      <Section>
        <Container size="wide" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">Préparer un évènement sans tout porter seul</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground text-pretty">
              Les professionnels, l'équipe et les invités d'un évènement au même endroit. Voici ce qui se passe, de la première recherche au lendemain de la fête.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/inscription?intent=organizer">Créer mon espace gratuitement</Link>
              </Button>
              <Link href="/annuaire/garde-enfants-evenementielle" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Voir les professionnels de la garde d'enfants
              </Link>
            </div>
          </div>
          <PhotoFrame photo={hero} corner="tr" priority width={1200} height={900} sizes="(max-width: 1024px) 100vw, 560px" caption="Photo de démonstration" alt="Mariés entourés de leurs invités, photo de démonstration" />
        </Container>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <Container size="wide">
          <ol className="space-y-16">
            {STAGES.map((j, i) => (
              <li key={j.title} className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${i % 2 === 1 ? "lg:[&>figure]:order-2" : ""}`}>
                <PhotoFrame photo={j.photo} corner={i % 2 ? "br" : "bl"} width={1200} height={900} sizes="(max-width: 1024px) 100vw, 50vw" caption="Photo de démonstration" />
                <div>
                  <h2 className="text-2xl font-semibold text-balance sm:text-3xl">
                    <span className="mr-2 text-primary tabular-nums">{i + 1}.</span>
                    {j.title}
                  </h2>
                  <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-muted-foreground marker:text-primary">
                    {j.items.map((item) => (
                      <li key={item} className="pl-1 text-pretty">
                        {item}
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
              <p className="mt-3 text-lg text-muted-foreground text-pretty">
                Quatre écrans de l'évènement {showcase.isDemo ? "de démonstration " : ""}« {showcase.name} », tels que l'organisateur les voit. Les chiffres sont lus dans la base, ils ne sont pas dessinés.
              </p>
              {showcase.isDemo && (
                <p className="mt-3">
                  <DemoLabel>Évènement fictif, personnes fictives</DemoLabel>
                </p>
              )}
            </div>
            <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
              <ControlTowerMockup event={showcase} />
              <div className="min-w-0 space-y-6">
                <ProvidersMockup event={showcase} />
                <KidsSpaceMockup event={showcase} />
              </div>
              <SeatingPlanMockup event={showcase} className="lg:col-span-2" />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Le plan de table, les QR codes personnalisés et les exports font partie de l'offre Organisateur Plus.</p>
          </Container>
        </Section>
      )}

      <Section id="demander-un-devis">
        <Container size="wide" className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div>
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Une demande de devis, concrètement</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Depuis une fiche, vous décrivez l'évènement en quelques champs. Le professionnel reçoit de quoi répondre sans vous rappeler pour les détails.</p>
            <InquiryExample className="mt-8" professionalName={example?.displayName} categoryName={example?.categoryName} />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">La fiche telle que vous la voyez</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Le métier, la zone, les prestations, une fourchette de prix, et le niveau de vérification détaillé au survol.</p>
            {example ? (
              <div className="mt-8 max-w-sm">
                <ProfessionalCard professional={example} />
                {example.isDemo && (
                  <p className="mt-3">
                    <DemoLabel>Fiche de démonstration</DemoLabel>
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-8 rounded-3xl bg-ivory-deep/70 p-6 dark:bg-ivory-deep/50">
                <CalendarScene className="mx-auto max-w-xs" />
                <p className="mt-2 text-center text-sm text-muted-foreground">Aucune fiche publiée pour l'instant.</p>
              </div>
            )}
          </div>
        </Container>
      </Section>

      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="narrow">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Ce qui est gratuit, ce qui est payant</h2>
          <dl className="mt-8 divide-y border-y">
            <div className="grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="font-semibold">Gratuit</dt>
              <dd className="leading-7 text-muted-foreground text-pretty">
                {FREE_EVENTS ? `Jusqu'à ${FREE_EVENTS} évènements, ` : ""}l'annuaire, les demandes, les tâches, le planning{FREE_CONTACTS ? `, ${FREE_CONTACTS} contacts` : ""}
                {FREE_INVITATIONS ? ` et ${FREE_INVITATIONS} invitations essentielles` : ""}.
              </dd>
            </div>
            <div className="grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt>
                <span className="block font-semibold">Organisateur Plus</span>
                <span className="text-sm text-muted-foreground">{PLUS_PRICE} TTC par mois</span>
              </dt>
              <dd className="leading-7 text-muted-foreground text-pretty">Plan de table, invitations personnalisées et QR codes, budget avancé, exports PDF et CSV, collaboration étendue. Sans engagement.</dd>
            </div>
            <div className="grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="font-semibold">Entre vous et vos prestataires</dt>
              <dd className="leading-7 text-muted-foreground text-pretty">Le contrat, le prix et le paiement de chaque prestation. Nous ne sommes ni intermédiaire de paiement ni employeur.</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Button asChild size="lg" className="rounded-full px-5">
              <Link href="/inscription?intent=organizer">Créer mon espace gratuitement</Link>
            </Button>
            <Link href="/tarifs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Comparer les offres
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
