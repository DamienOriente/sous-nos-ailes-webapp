import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ProfessionalCard } from "@/components/directory/professional-card";
import { WingsScene } from "@/components/illustrations";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { Container, Section } from "@/components/shared/section";
import { formatEuros } from "@/lib/utils";
import type { PublicCategory, PublicCounters } from "@/modules/analytics/application/public-counters";
import { PLAN_SEED } from "@/modules/billing/domain/plans";
import type { DirectoryCard } from "@/modules/directory/application/directory-search";
import type { EventShowcase, PublishedReview } from "@/modules/directory/application/public-showcase";
import { categoryPhoto, showcasePhoto, type ShowcaseSlot } from "@/modules/media/demo-photos";
import { HeroSearch } from "./hero-search";
import { ControlTowerMockup, KidsSpaceMockup } from "./mockups";
import { DemoLabel, PhotoFrame } from "./photo-frame";

/** Alternating section background: an opaque tint, never a gradient. */
const BAND = "bg-ivory-deep/60 dark:bg-ivory-deep/40";

function SectionTitle({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={className ?? "max-w-2xl"}>
      <h2 className="text-3xl font-semibold text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-lg text-muted-foreground text-pretty">{children}</p>}
    </div>
  );
}

const planPrice = (key: string) => formatEuros(PLAN_SEED.find((p) => p.key === key)?.priceMonthlyCents ?? 0);

// Hero
export function Hero({ categories, counters, isDemo }: { categories: PublicCategory[]; counters: PublicCounters; isDemo: boolean }) {
  const defaultSlug = categories.find((c) => c.slug === "garde-enfants-evenementielle")?.slug ?? categories.find((c) => c.isChildcare)?.slug ?? categories[0]?.slug ?? "garde-enfants-evenementielle";
  const showCounter = counters.publishedProfessionals > 0;
  const main = showcasePhoto("heroMain");
  const second = showcasePhoto("heroSecond");
  const third = showcasePhoto("heroThird");
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <Container size="wide" className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-20">
        <div className="max-w-xl">
          <h1 id="hero-title" className="text-[2.5rem] leading-[1.05] font-semibold text-balance sm:text-5xl" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}>
            Garde d'enfants et animation pour mariages, baptêmes et séminaires
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground text-pretty">
            Sous Nos Ailes recense des professionnels de la garde d'enfants et de l'évènementiel. Une fois votre équipe choisie, vous la retrouvez dans un espace commun : planning, invités, enfants, messages.
          </p>
          <div className="mt-8">
            <HeroSearch categories={categories.map((c) => ({ slug: c.slug, name: c.name, isChildcare: c.isChildcare }))} defaultSlug={defaultSlug} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Button asChild size="lg" variant="outline" className="rounded-full px-5">
              <Link href="/inscription?intent=organizer">Je prépare un évènement</Link>
            </Button>
            <Link href="/inscription?intent=professional" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Je propose mes services
            </Link>
          </div>
          {showCounter && (
            <p className="mt-6 text-sm text-muted-foreground">
              {counters.publishedProfessionals} fiche{counters.publishedProfessionals > 1 ? "s" : ""} publiée{counters.publishedProfessionals > 1 ? "s" : ""}
              {counters.childcareProfessionals > 0 && <>, dont {counters.childcareProfessionals} pour la garde d'enfants</>}.
              {isDemo && counters.demoProfessionals > 0 && <> Ce sont des fiches de démonstration.</>}
            </p>
          )}
        </div>
        {/* One large portrait, two small landscapes; the wings sit in the feathered corner of the main photo, never over a face. */}
        <div className="relative mx-auto w-full max-w-md pt-14 lg:max-w-none">
          <div className="grid grid-cols-[1.35fr_1fr] gap-3 sm:gap-4">
            <DemoPhoto photo={main} priority width={1000} height={1250} sizes="(max-width: 640px) 60vw, (max-width: 1024px) 300px, 360px" className="row-span-2 aspect-[4/5] rounded-[1.75rem] rounded-tl-[5rem]" alt="Enfants qui sautent de joie dans une forêt, photo de démonstration" />
            <DemoPhoto photo={second} width={800} height={600} sizes="(max-width: 640px) 40vw, (max-width: 1024px) 220px, 260px" className="aspect-[4/3] rounded-[1.5rem] rounded-tr-[3.5rem]" alt="Jeunes mariés dans une lumière dorée, photo de démonstration" />
            <DemoPhoto photo={third} width={800} height={600} sizes="(max-width: 640px) 40vw, (max-width: 1024px) 220px, 260px" className="aspect-[4/3] rounded-[1.5rem] rounded-br-[3.5rem]" alt="Invités qui trinquent, photo de démonstration" />
          </div>
          <WingsScene className="pointer-events-none absolute -top-2 -left-8 w-44 sm:w-52" />
          <p className="mt-3 font-heading text-sm text-muted-foreground italic">Photographies de démonstration.</p>
        </div>
      </Container>
    </section>
  );
}

// How it works
const STEPS = [
  { title: "Trouver les professionnels", text: "Choisissez un métier, une ville, une date. Chaque fiche indique ce que nous avons vérifié, la zone couverte et une fourchette de prix quand le professionnel l'a renseignée." },
  { title: "Réunir l'équipe", text: "Wedding planner, coorganisateur, traiteur, DJ : chacun reçoit un lien d'invitation et un rôle. Il ne voit que ce que son rôle permet." },
  { title: "Suivre le jour J", text: "Le planning est partagé avec tous. La liste des enfants n'est visible que de l'équipe de garde. Les invités répondent en ligne et se présentent avec un QR code." },
] as const;

export function HowItWorks() {
  const photo = showcasePhoto("organiserDuring");
  return (
    <Section id="comment-ca-marche">
      <Container size="wide" className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <PhotoFrame photo={photo} corner="tl" caption="Photo de démonstration" width={1200} height={900} sizes="(max-width: 1024px) 100vw, 45vw" />
        <div>
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Comment ça se passe</h2>
          <ol className="mt-8 divide-y">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5 first:pt-0 last:pb-0">
                <span className="font-heading text-3xl leading-none text-primary tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-7 text-muted-foreground text-pretty">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}

// Categories
export function Categories({ categories }: { categories: PublicCategory[] }) {
  const childcare = categories.filter((c) => c.isChildcare);
  const others = categories.filter((c) => !c.isChildcare);
  return (
    <Section id="metiers" className={BAND}>
      <Container size="wide">
        <SectionTitle title="Garde d'enfants et animation, puis les autres métiers">La garde et l'animation des enfants sont notre spécialité. Les autres métiers d'une réception sont référencés autour.</SectionTitle>
        {childcare.length > 0 && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {childcare.map((c) => {
              const photo = categoryPhoto(c.slug, 0);
              return (
                <li key={c.slug}>
                  <Link href={`/annuaire/${c.slug}`} className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card transition-colors hover:border-foreground/40">
                    <DemoPhoto photo={photo} width={800} height={520} sizes="(max-width: 640px) 100vw, 33vw" className="aspect-[16/10]" alt={`${photo.alt}, photo d'illustration`} />
                    <span className="flex flex-1 flex-col p-6">
                      <span className="text-lg font-semibold">{c.name}</span>
                      {c.description && <span className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">{c.description}</span>}
                      <span className="mt-4 text-sm font-medium text-primary">Voir les professionnels</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {others.length > 0 && (
          <>
            <h3 className="mt-12 text-xl font-semibold">Les autres métiers</h3>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2" aria-label="Autres métiers de l'évènementiel">
              {others.map((c) => (
                <li key={c.slug}>
                  <Link href={`/annuaire/${c.slug}`} className="text-primary underline-offset-4 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm">
              <Link href="/annuaire" className="font-medium text-primary underline-offset-4 hover:underline">
                Ouvrir tout l'annuaire
              </Link>
            </p>
          </>
        )}
      </Container>
    </Section>
  );
}

// Featured professionals
export function FeaturedProfessionals({ professionals }: { professionals: DirectoryCard[] }) {
  if (professionals.length === 0) return null;
  const anyDemo = professionals.some((p) => p.isDemo);
  return (
    <Section id="exemples-fiches">
      <Container size="wide">
        <SectionTitle title="À quoi ressemble une fiche">Le métier, la zone, les prestations, une fourchette de prix et le niveau de vérification. Les fiches ci-dessous viennent de l'annuaire.</SectionTitle>
        {anyDemo && (
          <p className="mt-3">
            <DemoLabel>Fiches de démonstration, professionnels fictifs</DemoLabel>
          </p>
        )}
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="featured-professionals">
          {professionals.map((p, i) => (
            <li key={p.id} className={i === 2 ? "sm:col-span-2 lg:col-span-1" : undefined}>
              <ProfessionalCard professional={p} />
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm">
          <Link href="/annuaire" className="font-medium text-primary underline-offset-4 hover:underline">
            Parcourir l'annuaire
          </Link>
        </p>
      </Container>
    </Section>
  );
}

// Event showcase
export function EventShowcaseSection({ event }: { event: EventShowcase | null }) {
  if (!event) return null;
  return (
    <Section id="exemple-evenement" className={BAND}>
      <Container size="wide">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Un évènement en préparation, côté organisateur</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">
              Voici l'espace d'un {event.type === "wedding" ? "mariage" : "évènement"}, tel que son organisateur le voit. Les chiffres sont lus dans l'évènement{event.isDemo ? " de démonstration" : ""}, ils ne sont pas dessinés.
            </p>
            {event.isDemo && (
              <p className="mt-3">
                <DemoLabel>Évènement fictif, personnes fictives</DemoLabel>
              </p>
            )}
            <ul className="mt-6 list-disc space-y-3 pl-5 leading-7 marker:text-primary">
              <li>L'organisateur voit tout. Chaque prestataire voit le planning et ce qui le concerne.</li>
              <li>L'équipe de garde a son propre espace pour les enfants, séparé du reste.</li>
              <li>Les invités répondent en ligne et se présentent avec un QR code le jour J.</li>
            </ul>
            <Button asChild className="mt-8 rounded-full px-5">
              <Link href="/organiser">Voir le parcours organisateur</Link>
            </Button>
          </div>
          <div className="min-w-0 space-y-6">
            <ControlTowerMockup event={event} />
            <KidsSpaceMockup event={event} />
          </div>
        </div>
      </Container>
    </Section>
  );
}

// Journeys
type Journey = { title: string; photo: ShowcaseSlot; corner: "tl" | "tr" | "bl"; moments: string[]; href: string; cta: string };

/** Numbers come from the demo event when it is available, never from the copywriter's imagination. */
function journeys(event: EventShowcase | null): Journey[] {
  const wedding = event && event.type === "wedding" ? event : null;
  const guests = wedding ? (wedding.expectedGuests ?? wedding.guests.total) : 0;
  const kids = wedding?.children.total ?? 0;
  return [
    {
      title: wedding && guests > 0 ? `Lisa prépare son mariage : ${guests} invités, ${kids} enfants` : "Lisa prépare son mariage",
      photo: "journeyOrganiser",
      corner: "tl",
      moments: [
        "Elle cherche une équipe de garde et un traiteur dans l'annuaire, puis envoie des demandes de devis.",
        "Elle invite sa wedding planner et ses prestataires. Chacun reçoit son accès et un rôle.",
        "Elle inscrit les enfants avec les consignes des parents.",
        "Le jour J, elle suit depuis son téléphone les arrivées des enfants et les réponses des invités.",
      ],
      href: "/organiser",
      cta: "Le parcours organisateur",
    },
    {
      title: "Julien, traiteur à Albi, reçoit des demandes complètes",
      photo: "journeyProfessional",
      corner: "tr",
      moments: [
        "Il publie sa fiche. L'équipe la relit sous 48 h ouvrées et affiche les vérifications réellement faites.",
        "Chaque demande arrive avec la date, la ville, le nombre d'invités et d'enfants.",
        "Pour un évènement confirmé, il consulte le planning du jour J et le plan de service.",
      ],
      href: "/professionnels",
      cta: "Le parcours professionnel",
    },
    {
      title: wedding && kids > 0 ? `Marie et son équipe gardent ${kids} enfants pendant la réception` : "Marie et son équipe gardent les enfants pendant la réception",
      photo: "journeyChildcare",
      corner: "bl",
      moments: [
        "Elle voit la liste des enfants : prénom, âge, personnes autorisées à venir les chercher.",
        "Elle lit les consignes des parents seulement s'ils ont donné leur consentement, et chaque lecture est journalisée.",
        "Elle note chaque arrivée et chaque remise. Les données des enfants sont anonymisées après l'évènement.",
      ],
      href: "/annuaire/garde-enfants-evenementielle",
      cta: "Les fiches de garde d'enfants",
    },
  ];
}

export function Journeys({ event }: { event: EventShowcase | null }) {
  return (
    <Section id="parcours">
      <Container size="wide">
        <SectionTitle title="Trois exemples tirés de la démonstration">Lisa, Julien et Marie sont des personnages fictifs. Ce qu'ils font sur la plateforme, en revanche, existe tel quel.</SectionTitle>
        <div className="mt-8 space-y-16">
          {journeys(event).map((j, i) => {
            const photo = showcasePhoto(j.photo);
            return (
              <article key={j.title} className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${i % 2 === 1 ? "lg:[&>figure]:order-2" : ""}`}>
                <PhotoFrame photo={photo} corner={j.corner} caption="Photo de démonstration" width={1200} height={900} sizes="(max-width: 1024px) 100vw, 50vw" />
                <div>
                  <h3 className="text-2xl font-semibold text-balance">{j.title}</h3>
                  <ol className="mt-5 list-decimal space-y-3 pl-5 leading-7 text-muted-foreground marker:font-heading marker:text-primary">
                    {j.moments.map((m) => (
                      <li key={m} className="pl-1 text-pretty">
                        {m}
                      </li>
                    ))}
                  </ol>
                  <Link href={j.href} className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {j.cta}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

// Trust
const VERIFICATION_LEVELS = [
  { label: "Identité déclarée", text: "Le professionnel a renseigné son identité et son activité. Nous n'avons pas encore consulté de pièce." },
  { label: "Immatriculation consultée", text: "Nous avons consulté l'immatriculation de l'entreprise (SIRENE ou extrait Kbis) et vérifié qu'elle correspond à la fiche." },
  { label: "Documents examinés", text: "Un membre de l'équipe a relu les justificatifs transmis (assurance, qualification). La fiche indique lesquels." },
];

export function Trust() {
  return (
    <Section id="confiance" className={BAND}>
      <Container size="wide" className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionTitle title="Ce que « vérifié » veut dire ici" className="">
            Nous ne créons pas de label. Chaque mention décrit un contrôle réellement effectué, et uniquement celui-là.
          </SectionTitle>
          <dl className="mt-8 divide-y">
            {VERIFICATION_LEVELS.map((l) => (
              <div key={l.label} className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[200px_1fr] sm:gap-6">
                <dt className="font-semibold">{l.label}</dt>
                <dd className="leading-7 text-muted-foreground text-pretty">{l.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">
            Ces niveaux ne sont ni une certification ni une garantie. Le détail est dans notre{" "}
            <Link href="/moderation" className="font-medium text-foreground underline underline-offset-4">
              politique de modération
            </Link>
            .
          </p>
        </div>
        <div className="rounded-3xl bg-sage-soft/70 p-6 sm:p-8 dark:bg-sage-soft/40">
          <h2 className="text-2xl font-semibold">Les données des enfants</h2>
          <p className="mt-4 leading-7 text-pretty">Une garde d'enfants demande des informations précises : qui vient chercher qui, quelle allergie, à quelle heure. Ces informations sont sensibles et traitées comme telles.</p>
          <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 marker:text-primary">
            <li>Seuls le prénom et l'âge sont enregistrés, jamais la date de naissance.</li>
            <li>Les allergies et consignes médicales sont chiffrées. Seule l'équipe de garde affectée à l'enfant peut les lire, avec le consentement explicite des parents.</li>
            <li>Chaque consultation est journalisée. Rien ne passe par e-mail ni par QR code.</li>
            <li>Tout est anonymisé automatiquement après l'évènement.</li>
          </ul>
          <Link href="/confidentialite" className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Lire la politique de confidentialité
          </Link>
        </div>
      </Container>
    </Section>
  );
}

// Reviews
export function Reviews({ reviews }: { reviews: PublishedReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <Section id="avis">
      <Container size="wide">
        <SectionTitle title="Les derniers avis publiés">Un avis n'est possible qu'après une demande ou un évènement réel, et il est relu avant publication.</SectionTitle>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col rounded-3xl border bg-card p-6">
              <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">Note : {r.rating} sur 5</span>
                {r.professional.isDemo && <DemoLabel>Avis de démonstration</DemoLabel>}
              </p>
              {r.title && <h3 className="mt-3 text-lg font-semibold">{r.title}</h3>}
              <p className="mt-2 flex-1 leading-7 text-muted-foreground text-pretty">{r.body}</p>
              <p className="mt-4 text-sm">
                <span className="font-medium">{r.authorLabel}</span>
                <span className="text-muted-foreground"> à propos de </span>
                <Link href={`/pro/${r.professional.slug}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {r.professional.displayName}
                </Link>
                <span className="block text-xs text-muted-foreground">{r.professional.categoryName}</span>
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

// Cities
export function Cities({ cities, isDemo }: { cities: PublicCounters["cities"]; isDemo: boolean }) {
  if (cities.length === 0) return null;
  return (
    <Section id="villes" className={BAND}>
      <Container size="wide">
        <SectionTitle title="Où trouver des professionnels">{isDemo ? "Environnement de démonstration : les fiches sont fictives." : "Les villes où des fiches sont publiées."}</SectionTitle>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          {cities.slice(0, 8).map((c) => (
            <li key={`${c.city}-${c.department ?? ""}`}>
              <Link href={`/annuaire?city=${encodeURIComponent(c.city)}`} className="font-heading text-xl text-primary underline-offset-4 hover:underline">
                {c.city}
              </Link>
              <span className="ml-2 text-sm text-muted-foreground">
                {c.count} fiche{c.count > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

// Pricing summary
export function PricingSummary() {
  return (
    <Section id="tarifs">
      <Container size="wide">
        <SectionTitle title="Ce qui est gratuit, ce qui est payant">L'annuaire, la fiche professionnelle, les demandes de devis, les tâches et le planning sont gratuits. Un organisateur peut préparer jusqu'à trois évènements sans payer.</SectionTitle>
        <dl className="mt-8 max-w-3xl divide-y border-y">
          <div className="grid gap-1 py-5 sm:grid-cols-[16rem_1fr] sm:gap-6">
            <dt>
              <span className="block font-semibold">Organisateur Plus</span>
              <span className="text-sm text-muted-foreground">{planPrice("organizer_plus")} TTC par mois</span>
            </dt>
            <dd className="leading-7 text-muted-foreground text-pretty">Plan de table, invitations personnalisées avec QR code, budget avancé, exports PDF et CSV.</dd>
          </div>
          <div className="grid gap-1 py-5 sm:grid-cols-[16rem_1fr] sm:gap-6">
            <dt>
              <span className="block font-semibold">Professionnel Premium</span>
              <span className="text-sm text-muted-foreground">{planPrice("professional_premium")} TTC par mois</span>
            </dt>
            <dd className="leading-7 text-muted-foreground text-pretty">Tous les modèles de page, outils métier, statistiques, synchronisation d'agenda.</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-muted-foreground">
          Prix indicatifs, susceptibles de changer avant l'ouverture commerciale. Résiliation en ligne à tout moment.{" "}
          <Link href="/tarifs" className="font-medium text-foreground underline underline-offset-4">
            Comparer les offres
          </Link>
        </p>
      </Container>
    </Section>
  );
}

// FAQ
export const HOME_FAQ = [
  {
    q: "Sous Nos Ailes emploie-t-il les professionnels de la garde d'enfants ?",
    a: "Non. Nous mettons en relation des organisateurs et des professionnels indépendants, puis nous fournissons les outils pour travailler ensemble. Le contrat de prestation se conclut directement entre vous et le professionnel.",
  },
  {
    q: "Que signifie « vérifié » sur une fiche ?",
    a: "Chaque mention décrit un contrôle précis : identité déclarée, immatriculation consultée, documents examinés. Nous indiquons ce que nous avons regardé, et rien de plus. Ce n'est ni une certification ni une garantie.",
  },
  {
    q: "Qui peut voir les informations sur mes enfants ?",
    a: "L'organisateur qui les a saisies et l'équipe de garde affectée à chaque enfant. Les informations de santé sont chiffrées, consultables uniquement avec votre consentement explicite, et chaque accès est enregistré. Tout est anonymisé après l'évènement.",
  },
  {
    q: "Dois-je payer pour organiser mon évènement ?",
    a: "Non. La recherche, les demandes, le planning, les tâches et les invitations essentielles sont gratuits. L'offre Organisateur Plus ajoute le plan de table, les QR codes et les exports.",
  },
  {
    q: "Les photos et les fiches que je vois sont-elles réelles ?",
    a: "En environnement de démonstration, les professionnels, les évènements et les avis sont fictifs et signalés comme tels ; les photographies sont des illustrations libres de droits. Aucune photo ne représente un vrai professionnel de la plateforme.",
  },
  {
    q: "Comment signaler un problème avec une fiche ou un message ?",
    a: "Depuis la page « Signaler un contenu », sans compte. Chaque signalement ouvre un dossier examiné par l'équipe, avec une décision motivée et une possibilité de recours.",
  },
];

export function Faq() {
  return (
    <Section id="faq" className={BAND}>
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Questions fréquentes</h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              Une autre question ?{" "}
              <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                Écrivez-nous
              </Link>
              .
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {HOME_FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">{item.q}</AccordionTrigger>
                <AccordionContent className="leading-7 text-muted-foreground text-pretty">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </Section>
  );
}

// Final call to action
export function FinalCta() {
  return (
    <Section>
      <Container size="narrow" className="text-center">
        <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Créer votre espace</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground text-pretty">C'est gratuit. Vous pouvez inviter votre équipe et chercher des professionnels dès l'inscription.</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/inscription?intent=organizer">Créer mon espace organisateur</Link>
          </Button>
          <Link href="/inscription?intent=professional" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Je suis professionnel : publier ma fiche
          </Link>
        </div>
      </Container>
    </Section>
  );
}
