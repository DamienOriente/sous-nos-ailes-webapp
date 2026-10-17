import Link from "next/link";
import { ArrowRight, Baby, CalendarCheck, LayoutGrid, MessageSquare, QrCode, ShieldCheck, Star } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ProfessionalCard } from "@/components/directory/professional-card";
import { ConfettiScene, WingsScene } from "@/components/illustrations";
import { HandoverScene, SearchScene, TeamScene } from "@/components/illustrations/public-scenes";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { Container, Section } from "@/components/shared/section";
import type { PublicCategory, PublicCounters } from "@/modules/analytics/application/public-counters";
import type { DirectoryCard } from "@/modules/directory/application/directory-search";
import type { EventShowcase, PublishedReview } from "@/modules/directory/application/public-showcase";
import { categoryPhoto, demoPhoto, type PhotoTheme } from "@/modules/media/demo-photos";
import { CategoryIcon } from "./category-icon";
import { HeroSearch } from "./hero-search";
import { Feather } from "./illustrations";
import { ControlTowerMockup, KidsSpaceMockup } from "./mockups";
import { DemoLabel, PhotoFrame } from "./photo-frame";

// ── Hero ────────────────────────────────────────────────────────────────────
export function Hero({ categories, counters, isDemo }: { categories: PublicCategory[]; counters: PublicCounters; isDemo: boolean }) {
  const defaultSlug = categories.find((c) => c.slug === "garde-enfants-evenementielle")?.slug ?? categories.find((c) => c.isChildcare)?.slug ?? categories[0]?.slug ?? "garde-enfants-evenementielle";
  const showCounter = counters.publishedProfessionals > 0;
  const main = demoPhoto("kids", 8);
  const second = demoPhoto("wedding", 0);
  const third = demoPhoto("toast", 0);
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <Container size="wide" className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-20">
        <div className="max-w-xl">
          <p className="text-base text-muted-foreground">Garde d'enfants et animation pour mariages, baptêmes et séminaires</p>
          <h1 id="hero-title" className="mt-3 text-[2.6rem] leading-[1.02] font-semibold text-balance sm:text-6xl" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}>
            Les enfants sont pris en charge. Vous pouvez profiter de la fête.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground text-pretty">
            Trouvez des professionnels de la garde d'enfants et de l'évènementiel, puis coordonnez toute votre équipe depuis un seul espace : planning, invités, enfants, messagerie.
          </p>
          <div className="mt-8">
            <HeroSearch categories={categories.map((c) => ({ slug: c.slug, name: c.name, isChildcare: c.isChildcare }))} defaultSlug={defaultSlug} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="rounded-full px-5">
              <Link href="/inscription?intent=organizer">Je prépare un évènement</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-5">
              <Link href="/inscription?intent=professional">Je propose mes services</Link>
            </Button>
          </div>
          {showCounter && (
            <p className="mt-6 text-sm text-muted-foreground">
              {counters.publishedProfessionals} fiche{counters.publishedProfessionals > 1 ? "s" : ""} professionnelle{counters.publishedProfessionals > 1 ? "s" : ""} publiée{counters.publishedProfessionals > 1 ? "s" : ""}
              {counters.childcareProfessionals > 0 && <>, dont {counters.childcareProfessionals} pour les enfants</>}
              {isDemo && counters.demoProfessionals > 0 && <> — données de démonstration</>}.
            </p>
          )}
        </div>
        {/* Photo composition: one large portrait, two small landscapes, the wings sheltering the whole. */}
        <div className="relative mx-auto w-full max-w-md pt-14 lg:max-w-none">
          <div className="grid grid-cols-[1.35fr_1fr] gap-3 sm:gap-4">
            <DemoPhoto photo={main} priority width={1000} height={1250} sizes="(max-width: 640px) 60vw, (max-width: 1024px) 300px, 360px" className="row-span-2 aspect-[4/5] rounded-[1.75rem] rounded-tl-[5rem]" alt="Enfants qui sautent de joie dans une forêt — photo de démonstration" />
            <DemoPhoto photo={second} width={800} height={600} sizes="(max-width: 640px) 40vw, (max-width: 1024px) 220px, 260px" className="aspect-[4/3] rounded-[1.5rem] rounded-tr-[3.5rem]" alt="Jeunes mariés dans une lumière dorée — photo de démonstration" />
            <DemoPhoto photo={third} width={800} height={600} sizes="(max-width: 640px) 40vw, (max-width: 1024px) 220px, 260px" className="aspect-[4/3] rounded-[1.5rem] rounded-br-[3.5rem]" alt="Invités qui trinquent — photo de démonstration" />
          </div>
          {/* The wings nest in the feathered corner of the main photo, never over a face. */}
          <WingsScene className="pointer-events-none absolute -top-2 -left-8 w-44 drop-shadow-[0_18px_30px_oklch(0.48_0.07_150_/_0.25)] sm:w-52" />
          <p className="mt-3 font-heading text-sm text-muted-foreground italic">Photographies de démonstration.</p>
        </div>
      </Container>
    </section>
  );
}

// ── Value proposition ───────────────────────────────────────────────────────
const VALUE = [
  {
    tone: "sage",
    title: "Pour celles et ceux qui organisent",
    text: "Un évènement rassemble souvent dix prestataires et une centaine d'invités. Ici, tout le monde travaille sur le même planning, avec les bons droits, sans fil de discussion perdu.",
    href: "/organiser",
    cta: "Comment ça se passe",
  },
  {
    tone: "blush",
    title: "Pour les professionnels de la garde d'enfants",
    text: "Une fiche claire sur ce que vous proposez, des demandes qualifiées, et le jour J un espace enfants sécurisé : présences, personnes autorisées, consignes des parents.",
    href: "/annuaire/garde-enfants-evenementielle",
    cta: "Voir les fiches garde d'enfants",
  },
  {
    tone: "sky",
    title: "Pour tous les métiers de l'évènement",
    text: "Traiteurs, lieux, photographes, DJ, fleuristes : votre page publique, votre agenda et les informations utiles de chaque évènement où vous intervenez, rien de plus.",
    href: "/professionnels",
    cta: "Rejoindre la plateforme",
  },
] as const;

const TONE_RULE: Record<(typeof VALUE)[number]["tone"], string> = { sage: "bg-sage", blush: "bg-blush-deep", sky: "bg-sky-deep" };

export function ValueProposition() {
  return (
    <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
      <Container size="wide">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {VALUE.map((v) => (
            <article key={v.title} className="flex flex-col">
              <span className={`mb-5 h-1 w-14 rounded-full ${TONE_RULE[v.tone]}`} aria-hidden="true" />
              <h2 className="text-xl font-semibold text-balance">{v.title}</h2>
              <p className="mt-3 flex-1 leading-7 text-muted-foreground text-pretty">{v.text}</p>
              <Link href={v.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                {v.cta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────
const STEPS = [
  { step: 1, title: "Trouvez les bons professionnels", text: "Cherchez par métier et par zone. Chaque fiche indique précisément ce qui a été vérifié.", Scene: SearchScene },
  { step: 2, title: "Réunissez votre équipe", text: "Invitez prestataires, coorganisateurs et wedding planner. Chacun ne voit que ce que son rôle autorise.", Scene: TeamScene },
  { step: 3, title: "Vivez le jour J sereinement", text: "Planning partagé, enfants pris en charge et remis aux bonnes personnes, invités accueillis au QR code.", Scene: HandoverScene },
] as const;

export function HowItWorks() {
  return (
    <Section id="comment-ca-marche">
      <Container size="wide">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Trois étapes, un seul espace</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">De la première recherche au dernier invité raccompagné.</p>
        </div>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.step} className="flex flex-col">
              <div className="rounded-[1.75rem] rounded-tl-[3.5rem] bg-ivory-deep/70 p-4 dark:bg-ivory-deep/50">
                <s.Scene className="mx-auto max-w-xs" />
              </div>
              <p className="mt-5 text-sm font-medium text-primary">Étape {s.step}</p>
              <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-7 text-muted-foreground text-pretty">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

// ── Categories ──────────────────────────────────────────────────────────────
/** Hand-picked photo per childcare trade (the generic category mapping is for the long tail). */
const CHILDCARE_PHOTOS: Record<string, { theme: PhotoTheme; index: number }> = {
  "garde-enfants-evenementielle": { theme: "kids", index: 1 },
  "baby-sitting": { theme: "kids", index: 7 },
  "animation-enfants": { theme: "balloons", index: 0 },
};

export function Categories({ categories }: { categories: PublicCategory[] }) {
  const childcare = categories.filter((c) => c.isChildcare);
  const others = categories.filter((c) => !c.isChildcare);
  return (
    <Section id="metiers" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
      <Container size="wide">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">D'abord les enfants, puis tout le reste</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Notre spécialité est la garde et l'animation des enfants pendant vos évènements. Autour, tous les métiers dont une belle journée a besoin.</p>
          </div>
          <Link href="/annuaire" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Tout l'annuaire
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {childcare.length > 0 && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {childcare.map((c, i) => {
              const pick = CHILDCARE_PHOTOS[c.slug];
              const photo = pick ? demoPhoto(pick.theme, pick.index) : categoryPhoto(c.slug, i);
              return (
                <li key={c.slug}>
                  <Link href={`/annuaire/${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-blush/70 bg-card transition-shadow hover:shadow-soft dark:border-blush">
                    <DemoPhoto photo={photo} width={800} height={520} sizes="(max-width: 640px) 100vw, 33vw" className="aspect-[16/10]" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" alt={`${photo.alt} — photo d'illustration`} />
                    <span className="flex flex-1 flex-col p-5">
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={c.icon} className="size-5 text-blush-deep" />
                        <span className="text-lg font-semibold">{c.name}</span>
                      </span>
                      {c.description && <span className="mt-1.5 text-sm leading-6 text-muted-foreground text-pretty">{c.description}</span>}
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                        Voir les professionnels
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {others.length > 0 && (
          <div className="mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
            <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8 [scrollbar-width:thin]" aria-label="Autres métiers de l'évènementiel">
              {others.map((c, i) => {
                const photo = categoryPhoto(c.slug, i % 2);
                return (
                  <li key={c.slug} className="w-40 shrink-0 snap-start sm:w-44">
                    <Link href={`/annuaire/${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/60">
                      <DemoPhoto photo={photo} width={480} height={320} sizes="176px" className="aspect-[3/2]" alt="" />
                      <span className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                        <CategoryIcon name={c.icon} className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{c.name}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="px-4 font-heading text-sm text-muted-foreground italic sm:px-6 lg:px-8">Photos d'illustration. Faites défiler pour voir tous les métiers.</p>
          </div>
        )}
      </Container>
    </Section>
  );
}

// ── Featured professionals ──────────────────────────────────────────────────
export function FeaturedProfessionals({ professionals }: { professionals: DirectoryCard[] }) {
  if (professionals.length === 0) return null;
  const anyDemo = professionals.some((p) => p.isDemo);
  return (
    <Section id="exemples-fiches">
      <Container size="wide">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">À quoi ressemble une fiche</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Métier, zone, prestations, fourchette de prix et ce que nous avons réellement vérifié. Rien d'autre.</p>
            {anyDemo && (
              <p className="mt-2">
                <DemoLabel>Fiches de démonstration — professionnels fictifs</DemoLabel>
              </p>
            )}
          </div>
          <Link href="/annuaire" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Parcourir l'annuaire
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="featured-professionals">
          {professionals.map((p, i) => (
            <li key={p.id} className={i === 2 ? "sm:col-span-2 lg:col-span-1" : undefined}>
              <ProfessionalCard professional={p} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

// ── Event showcase ──────────────────────────────────────────────────────────
export function EventShowcaseSection({ event }: { event: EventShowcase | null }) {
  if (!event) return null;
  return (
    <Section id="exemple-evenement" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
      <Container size="wide">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Un évènement en préparation, vu de l'intérieur</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">
              Voici l'espace d'un {event.type === "wedding" ? "mariage" : "évènement"} tel que son organisateur le voit : invités, prestataires, enfants, planning. Les chiffres sont lus en direct dans l'évènement
              {event.isDemo ? " de démonstration" : ""}.
            </p>
            {event.isDemo && (
              <p className="mt-3">
                <DemoLabel>Évènement fictif, personnes fictives</DemoLabel>
              </p>
            )}
            <ul className="mt-6 space-y-3 leading-7">
              {[
                "L'organisateur voit tout ; chaque prestataire voit le planning et ce qui le concerne.",
                "L'équipe de garde dispose d'un espace enfants dédié, séparé du reste.",
                "Les invités répondent en ligne et sont accueillis au QR code le jour J.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Feather className="mt-1 size-4 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 rounded-full px-5">
              <Link href="/organiser">Voir le parcours organisateur</Link>
            </Button>
          </div>
          <div className="min-w-0 space-y-4">
            <ControlTowerMockup event={event} />
            <KidsSpaceMockup event={event} />
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ── Journeys ────────────────────────────────────────────────────────────────
const JOURNEYS: Array<{ who: string; title: string; photo: { theme: PhotoTheme; index: number }; corner: "tl" | "tr" | "bl"; moments: string[]; href: string; cta: string }> = [
  {
    who: "Organisatrice",
    title: "Lisa prépare son mariage avec 120 invités et 14 enfants",
    photo: { theme: "wedding", index: 3 },
    corner: "tl",
    moments: ["Trouve une équipe de garde et un traiteur dans l'annuaire, envoie trois demandes de devis.", "Invite sa wedding planner et ses prestataires : chacun reçoit son accès, rien de plus.", "Le jour J, suit les arrivées des enfants et les réponses des invités depuis son téléphone."],
    href: "/organiser",
    cta: "Le parcours organisateur",
  },
  {
    who: "Professionnel",
    title: "Julien, traiteur, reçoit des demandes complètes",
    photo: { theme: "food", index: 0 },
    corner: "tr",
    moments: ["Publie sa fiche, relue par l'équipe sous 48 h ouvrées, avec les vérifications réellement effectuées.", "Reçoit la date, la ville, le nombre d'invités et d'enfants avant même de répondre.", "Consulte le planning du jour J et le plan de service de l'évènement où il intervient."],
    href: "/professionnels",
    cta: "Le parcours professionnel",
  },
  {
    who: "Garde d'enfants",
    title: "Marie et son équipe gardent neuf enfants pendant la réception",
    photo: { theme: "kids", index: 4 },
    corner: "bl",
    moments: ["Voit la liste des enfants : prénom, âge, personnes autorisées à venir les chercher.", "Déchiffre les consignes des parents uniquement avec leur consentement, accès journalisé.", "Enregistre chaque arrivée, chaque remise ; tout est anonymisé après l'évènement."],
    href: "/annuaire/garde-enfants-evenementielle",
    cta: "Les fiches garde d'enfants",
  },
];

export function Journeys() {
  return (
    <Section id="parcours">
      <Container size="wide">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Trois parcours, racontés depuis les données de démonstration</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">Lisa, Julien et Marie sont des personnages fictifs ; les étapes, elles, sont celles de la plateforme.</p>
        </div>
        <div className="mt-12 space-y-14">
          {JOURNEYS.map((j, i) => {
            const photo = demoPhoto(j.photo.theme, j.photo.index);
            const reverse = i % 2 === 1;
            return (
              <article key={j.who} className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${reverse ? "lg:[&>figure]:order-2" : ""}`}>
                <PhotoFrame photo={photo} corner={j.corner} caption="Photo de démonstration" width={1200} height={900} sizes="(max-width: 1024px) 100vw, 50vw" />
                <div>
                  <p className="text-sm font-medium text-primary">{j.who}</p>
                  <h3 className="mt-1 text-2xl font-semibold text-balance">{j.title}</h3>
                  <ol className="mt-5 space-y-4">
                    {j.moments.map((m, k) => (
                      <li key={m} className="flex gap-4">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-soft font-heading text-sm font-semibold text-sage-deep dark:text-foreground" aria-hidden="true">
                          {k + 1}
                        </span>
                        <span className="leading-7 text-muted-foreground text-pretty">{m}</span>
                      </li>
                    ))}
                  </ol>
                  <Link href={j.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    {j.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
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

// ── Trust ───────────────────────────────────────────────────────────────────
const VERIFICATION_LEVELS = [
  { label: "Identité déclarée", text: "Le professionnel a renseigné son identité et son activité. Nous n'avons pas encore consulté de pièce." },
  { label: "Immatriculation consultée", text: "Nous avons consulté l'immatriculation de l'entreprise (SIRENE ou extrait Kbis) et sa cohérence avec la fiche." },
  { label: "Documents examinés", text: "Les justificatifs transmis (assurance, qualification) ont été relus par un membre de l'équipe ; la fiche indique lesquels." },
];

export function Trust() {
  return (
    <Section id="confiance" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
      <Container size="wide" className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Ce que « vérifié » veut dire ici</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">Nous n'inventons pas de label. Chaque mention décrit un contrôle réellement effectué, et uniquement celui-là.</p>
          <dl className="mt-8 divide-y">
            {VERIFICATION_LEVELS.map((l) => (
              <div key={l.label} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                <dt className="flex items-start gap-2 font-semibold">
                  <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {l.label}
                </dt>
                <dd className="leading-7 text-muted-foreground text-pretty">{l.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Les niveaux de vérification ne sont pas une certification ni une garantie. Détails dans notre{" "}
            <Link href="/moderation" className="font-medium underline underline-offset-4">
              politique de modération
            </Link>
            .
          </p>
        </div>
        <div className="rounded-3xl bg-sage-soft/70 p-7 sm:p-9 dark:bg-sage-soft/40">
          <div className="flex items-center gap-3">
            <Baby className="size-6 text-primary" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">Les données des enfants</h2>
          </div>
          <p className="mt-4 leading-7 text-pretty">Une garde d'enfants a besoin d'informations précises : qui vient chercher qui, quelle allergie, à quelle heure. Ces informations sont rares et sensibles ; nous les traitons comme telles.</p>
          <ul className="mt-5 space-y-3 leading-7">
            {["Seul le prénom et l'âge sont enregistrés — jamais la date de naissance.", "Les allergies et consignes médicales sont chiffrées et visibles uniquement par l'équipe de garde affectée à l'enfant, avec le consentement explicite des parents.", "Chaque consultation est journalisée ; rien ne transite par e-mail ni par QR code.", "Tout est anonymisé automatiquement après l'évènement."].map((t) => (
              <li key={t} className="flex gap-3">
                <Feather className="mt-1 size-4 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Link href="/confidentialite" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Lire la politique de confidentialité
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </Section>
  );
}

// ── Tools ───────────────────────────────────────────────────────────────────
const TOOLS = [
  { icon: LayoutGrid, title: "Tour de contrôle", text: "Tâches par étape, budget prévu et engagé, documents, prestataires : l'état de l'évènement en un regard." },
  { icon: CalendarCheck, title: "Planning du jour J", text: "Les moments clés partagés avec chaque prestataire, dans son fuseau et avec ses propres repères." },
  { icon: QrCode, title: "Invitations et QR codes", text: "Invitations personnalisées, réponses suivies, contrôle d'accès par QR code sans aucune donnée personnelle dedans." },
  { icon: Baby, title: "Espace enfants", text: "Liste des enfants, présences, remise aux personnes autorisées, consignes des parents — réservé à l'équipe de garde." },
  { icon: MessageSquare, title: "Messagerie d'équipe", text: "Des canaux par sujet au sein de l'évènement. L'organisateur voit tout ; les prestataires, ce qui les concerne." },
] as const;

export function Tools() {
  return (
    <Section id="outils">
      <Container size="wide">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Les outils du jour J, sans logiciel à installer</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">Chaque métier active les outils qui lui servent. Les autres restent hors de vue.</p>
        </div>
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.title} className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
                <t.icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">{t.text}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-dashed text-muted-foreground">
              <ArrowRight className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold">Plan de table, exports, synchronisation d'agenda</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
                Inclus dans les offres payantes.{" "}
                <Link href="/tarifs" className="font-medium text-primary hover:underline">
                  Voir les tarifs
                </Link>
              </p>
            </div>
          </li>
        </ul>
      </Container>
    </Section>
  );
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export function Reviews({ reviews }: { reviews: PublishedReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <Section id="avis" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
      <Container size="wide">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Des avis publiés, jamais inventés</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">Un avis ne peut être déposé qu'après une demande ou un évènement réel, et n'apparaît qu'une fois relu. Voici les derniers publiés.</p>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col rounded-3xl border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <span role="img" className="inline-flex items-center gap-0.5" aria-label={`Note ${r.rating} sur 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-4 ${i < r.rating ? "fill-gold text-gold" : "text-muted-foreground/40"}`} aria-hidden="true" />
                  ))}
                </span>
                {r.professional.isDemo && <DemoLabel>Avis de démonstration</DemoLabel>}
              </div>
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

// ── Cities ──────────────────────────────────────────────────────────────────
const CITY_THEMES: PhotoTheme[] = ["venue", "terrace", "landscape", "reception", "flowers", "room", "seminar", "toast"];

export function Cities({ cities, isDemo }: { cities: PublicCounters["cities"]; isDemo: boolean }) {
  if (cities.length === 0) return null;
  return (
    <Section id="villes">
      <Container size="wide">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Des professionnels déjà présents à</h2>
            {isDemo && <p className="mt-2 text-sm text-muted-foreground">Environnement de démonstration : les fiches sont fictives, les photos sont des illustrations.</p>}
          </div>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cities.slice(0, 8).map((c, i) => {
            const photo = demoPhoto(CITY_THEMES[i % CITY_THEMES.length] ?? "venue", Math.floor(i / CITY_THEMES.length));
            return (
              <li key={`${c.city}-${c.department ?? ""}`}>
                <Link href={`/annuaire?city=${encodeURIComponent(c.city)}`} className="group relative block overflow-hidden rounded-2xl">
                  <DemoPhoto photo={photo} width={640} height={480} sizes="(max-width: 640px) 50vw, 25vw" className="aspect-[4/3]" imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" alt="" />
                  <span className="absolute inset-0 bg-gradient-to-t from-[oklch(0.2_0.02_260_/_0.78)] via-transparent to-transparent" aria-hidden="true" />
                  <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-2 p-3 text-white">
                    <span className="font-heading text-lg font-semibold">{c.city}</span>
                    <span className="text-xs opacity-90">
                      {c.count} fiche{c.count > 1 ? "s" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}

// ── Pricing summary ─────────────────────────────────────────────────────────
export function PricingSummary() {
  return (
    <Section id="tarifs" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
      <Container size="wide">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Gratuit pour commencer, clair pour continuer</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">L'annuaire, la fiche professionnelle, les demandes et la préparation d'un évènement sont gratuits. Deux offres payantes ajoutent les outils avancés, sans engagement.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-card p-7">
            <h3 className="text-lg font-semibold">Organisateur Plus</h3>
            <p className="mt-1 text-muted-foreground">Plan de table, invitations personnalisées et QR codes, budget avancé, exports.</p>
            <p className="mt-5 font-heading text-3xl font-semibold">
              9,90 € <span className="text-base font-normal text-muted-foreground">TTC / mois</span>
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-7">
            <h3 className="text-lg font-semibold">Professionnel Premium</h3>
            <p className="mt-1 text-muted-foreground">Bibliothèque complète de modèles de page, outils métier, statistiques, synchronisation d'agenda.</p>
            <p className="mt-5 font-heading text-3xl font-semibold">
              19,90 € <span className="text-base font-normal text-muted-foreground">TTC / mois</span>
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Prix indicatifs susceptibles d'évoluer avant l'ouverture commerciale. Résiliable à tout moment en ligne.{" "}
          <Link href="/tarifs" className="font-medium text-primary underline-offset-4 hover:underline">
            Comparer les offres en détail
          </Link>
        </p>
      </Container>
    </Section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
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
    <Section id="faq">
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

// ── Final CTA ───────────────────────────────────────────────────────────────
export function FinalCta() {
  return (
    <Section className="pt-0">
      <Container size="wide">
        <div className="relative overflow-hidden rounded-[2rem] bg-sage-deep px-7 py-12 text-primary-foreground sm:px-12 sm:py-16 dark:bg-sage-soft dark:text-foreground">
          <ConfettiScene className="pointer-events-none absolute -top-6 right-0 hidden w-72 opacity-70 md:block" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Prêt à préparer votre évènement ?</h2>
            <p className="mt-3 text-lg opacity-90 text-pretty">Créez votre espace, invitez votre équipe et trouvez les professionnels qu'il vous manque. C'est gratuit pour commencer.</p>
          </div>
          <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="rounded-full px-5">
              <Link href="/inscription?intent=organizer">Créer mon espace organisateur</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/40 bg-transparent px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:border-foreground/30 dark:text-foreground">
              <Link href="/inscription?intent=professional">Publier ma fiche professionnelle</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
