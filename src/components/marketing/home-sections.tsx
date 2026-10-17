import Link from "next/link";
import { ArrowRight, Baby, CalendarCheck, LayoutGrid, MessageSquare, QrCode, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/shared/section";
import type { PublicCategory, PublicCounters } from "@/modules/analytics/application/public-counters";
import { CategoryIcon } from "./category-icon";
import { HeroSearch } from "./hero-search";
import { Feather, StepGlyph, WingsIllustration } from "./illustrations";

// ── Hero ────────────────────────────────────────────────────────────────────
export function Hero({ categories, counters, isDemo }: { categories: PublicCategory[]; counters: PublicCounters; isDemo: boolean }) {
  const defaultSlug = categories.find((c) => c.slug === "garde-enfants-evenementielle")?.slug ?? categories.find((c) => c.isChildcare)?.slug ?? categories[0]?.slug ?? "garde-enfants-evenementielle";
  const showCounter = counters.publishedProfessionals > 0;
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <Container size="wide" className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-24">
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
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <WingsIllustration className="drop-shadow-[0_24px_40px_oklch(0.48_0.07_150_/_0.18)]" />
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
const STEPS: Array<{ step: 1 | 2 | 3; title: string; text: string }> = [
  { step: 1, title: "Trouvez les bons professionnels", text: "Cherchez par métier et par zone. Chaque fiche indique précisément ce qui a été vérifié." },
  { step: 2, title: "Réunissez votre équipe", text: "Invitez prestataires, coorganisateurs et wedding planner. Chacun ne voit que ce que son rôle autorise." },
  { step: 3, title: "Vivez le jour J sereinement", text: "Planning partagé, enfants pris en charge, invités accueillis au QR code. Tout est au même endroit." },
];

export function HowItWorks() {
  return (
    <Section id="comment-ca-marche">
      <Container size="wide">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Trois étapes, un seul espace</h2>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">De la première recherche au dernier invité raccompagné.</p>
        </div>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.step} className="relative flex gap-5 md:flex-col">
              <StepGlyph step={s.step} className="shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">Étape {s.step}</p>
                <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-7 text-muted-foreground text-pretty">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

// ── Categories ──────────────────────────────────────────────────────────────
export function Categories({ categories }: { categories: PublicCategory[] }) {
  const childcare = categories.filter((c) => c.isChildcare);
  const groups = new Map<string, PublicCategory[]>();
  for (const c of categories) {
    if (c.isChildcare) continue;
    const list = groups.get(c.group) ?? [];
    list.push(c);
    groups.set(c.group, list);
  }
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
            {childcare.map((c) => (
              <li key={c.slug}>
                <Link href={`/annuaire/${c.slug}`} className="group flex h-full flex-col rounded-3xl border border-blush/70 bg-blush/40 p-6 transition-colors hover:bg-blush/60 dark:border-blush dark:bg-blush/30">
                  <CategoryIcon name={c.icon} className="size-7 text-blush-deep" />
                  <h3 className="mt-5 text-lg font-semibold">{c.name}</h3>
                  {c.description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground text-pretty">{c.description}</p>}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                    Voir les professionnels
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[...groups.entries()].map(([group, items]) => (
            <div key={group}>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Feather className="size-4" />
                {group}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {items.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/annuaire/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/60 hover:text-primary">
                      <CategoryIcon name={c.icon} className="size-3.5 text-muted-foreground" />
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
    <Section id="confiance">
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
            <li className="flex gap-3">
              <Feather className="mt-1 size-4 shrink-0" />
              <span>Seul le prénom et l'âge sont enregistrés — jamais la date de naissance.</span>
            </li>
            <li className="flex gap-3">
              <Feather className="mt-1 size-4 shrink-0" />
              <span>Les allergies et consignes médicales sont chiffrées et visibles uniquement par l'équipe de garde affectée à l'enfant, avec le consentement explicite des parents.</span>
            </li>
            <li className="flex gap-3">
              <Feather className="mt-1 size-4 shrink-0" />
              <span>Chaque consultation est journalisée ; rien ne transite par e-mail ni par QR code.</span>
            </li>
            <li className="flex gap-3">
              <Feather className="mt-1 size-4 shrink-0" />
              <span>Tout est anonymisé automatiquement après l'évènement.</span>
            </li>
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
    <Section id="outils" className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
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

// ── Cities ──────────────────────────────────────────────────────────────────
export function Cities({ cities, isDemo }: { cities: PublicCounters["cities"]; isDemo: boolean }) {
  if (cities.length === 0) return null;
  return (
    <Section id="villes">
      <Container size="wide">
        <h2 className="text-2xl font-semibold text-balance sm:text-3xl">Des professionnels déjà présents à</h2>
        {isDemo && <p className="mt-2 text-sm text-muted-foreground">Environnement de démonstration : les fiches sont fictives.</p>}
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-lg">
          {cities.map((c) => (
            <li key={`${c.city}-${c.department ?? ""}`}>
              <Link href={`/annuaire?city=${encodeURIComponent(c.city)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {c.city}
              </Link>
              <span className="ml-1.5 text-sm text-muted-foreground">({c.count})</span>
            </li>
          ))}
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
            <p className="mt-5 font-heading text-3xl font-semibold">9,90 € <span className="text-base font-normal text-muted-foreground">TTC / mois</span></p>
          </div>
          <div className="rounded-3xl border bg-card p-7">
            <h3 className="text-lg font-semibold">Professionnel Premium</h3>
            <p className="mt-1 text-muted-foreground">Bibliothèque complète de modèles de page, outils métier, statistiques, synchronisation d'agenda.</p>
            <p className="mt-5 font-heading text-3xl font-semibold">19,90 € <span className="text-base font-normal text-muted-foreground">TTC / mois</span></p>
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
          <Feather tone="gold" className="absolute top-6 right-8 size-10 opacity-70" />
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Prêt à préparer votre évènement ?</h2>
            <p className="mt-3 text-lg opacity-90 text-pretty">Créez votre espace, invitez votre équipe et trouvez les professionnels qu'il vous manque. C'est gratuit pour commencer.</p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
