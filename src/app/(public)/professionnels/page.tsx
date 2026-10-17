import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, Inbox, LayoutTemplate, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { ProfessionalCard } from "@/components/directory/professional-card";
import { VerificationBadge } from "@/components/directory/verification-badge";
import { CalendarScene, CameraScene } from "@/components/illustrations";
import { InquiryScene } from "@/components/illustrations/public-scenes";
import { InquiryExample } from "@/components/marketing/mockups";
import { DemoLabel, PhotoFrame } from "@/components/marketing/photo-frame";
import { Container, Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";
import { listFeaturedProfessionals } from "@/modules/directory/application/public-showcase";
import { showcasePhoto } from "@/modules/media/demo-photos";
import { VERIFICATION_KIND_LABELS, VERIFICATION_KINDS } from "@/modules/professionals/domain/verification";

export const metadata: Metadata = {
  title: "Vous êtes professionnel ? Rejoignez l'annuaire",
  description: "Fiche gratuite, page publique, demandes de devis, calendrier et outils métier pour les professionnels de la garde d'enfants et de l'évènementiel. Vérifications transparentes, sans fausse promesse.",
  alternates: { canonical: new URL("/professionnels", env.APP_URL).toString() },
};

const BENEFITS = [
  { icon: LayoutTemplate, title: "Une fiche et une page publique", text: "Votre fiche dans l'annuaire et une page personnalisable à partir de modèles pensés pour votre métier. Relecture humaine avant publication." },
  { icon: Inbox, title: "Des demandes qualifiées", text: "Contact, disponibilité ou devis : les organisateurs vous écrivent avec la date, la ville, le nombre d'invités et d'enfants. Vous répondez depuis votre espace, par e-mail au demandeur." },
  { icon: CalendarCheck, title: "Calendrier et disponibilités", text: "Grille hebdomadaire, indisponibilités, synchronisation Google / Outlook en Premium. L'annuaire respecte vos créneaux quand un organisateur filtre par date." },
  { icon: Wrench, title: "Des outils métier", text: "Liste des enfants pris en charge, présences et remise, brief musical, plan de service, espaces et logistique… activés selon votre métier." },
  { icon: Sparkles, title: "Un classement loyal", text: "Pertinence métier, proximité, disponibilité, complétude et vérifications. Les emplacements sponsorisés sont séparés et étiquetés : ils n'évincent jamais les résultats gratuits." },
  { icon: ShieldCheck, title: "Des vérifications transparentes", text: "Nous affichons exactement ce que nous avons contrôlé — jamais une « certification ». C'est ce qui rend la confiance crédible." },
];

const ONBOARDING = [
  { title: "Votre métier", text: "Choisissez votre métier principal et, si besoin, un ou deux métiers secondaires." },
  { title: "Votre structure", text: "Nom commercial, statut, ville et rayon d'intervention. Le SIRET sert à la vérification, il n'est pas publié." },
  { title: "Votre activité", text: "Pour la garde d'enfants : tranches d'âge, ratio d'encadrement déclaré, expérience. Pour les autres métiers : prestations et capacités." },
  { title: "Votre fiche", text: "Accroche, description, fourchette de prix, types d'évènements, photos. Enregistré au fur et à mesure." },
  { title: "Relecture", text: "Un membre de l'équipe relit la fiche sous 48 h ouvrées, puis elle est publiée dans l'annuaire." },
];

export default async function ProfessionalsLandingPage() {
  const featured = await listFeaturedProfessionals(2).catch(() => []);
  const hero = showcasePhoto("professionalsHero");
  return (
    <>
      <Section className="bg-gradient-to-b from-sage-soft/40 to-background">
        <Container size="wide" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div className="space-y-6">
            <p className="text-base text-muted-foreground">Vous êtes professionnel ?</p>
            <h1 className="font-heading text-4xl font-semibold text-balance sm:text-5xl">Soyez trouvé par les familles et les organisateurs qui cherchent exactement ce que vous faites</h1>
            <p className="text-lg text-muted-foreground text-pretty">Garde d'enfants, animation, lieux, traiteurs, DJ, photographes… Sous Nos Ailes met en avant les professionnels qui prennent soin des évènements où il y a des enfants. Fiche gratuite, relue par des humains.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/inscription?intent=professional">Créer ma fiche gratuitement</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link href="#verification">Comment fonctionnent les vérifications</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Sans engagement. Offre Premium optionnelle (19,90 € TTC / mois) pour la bibliothèque complète de modèles, les statistiques et les outils avancés.</p>
          </div>
          <div className="relative pb-8">
            <PhotoFrame photo={hero} corner="tl" priority width={1200} height={900} sizes="(max-width: 1024px) 100vw, 560px" alt="Photographe cadrant avec son boîtier — photo de démonstration" />
            <p className="absolute top-3 right-4 rounded-full bg-background/85 px-2.5 py-0.5 font-heading text-xs text-muted-foreground italic">Photo de démonstration</p>
            <Card className="absolute bottom-0 -left-2 w-64 gap-2 p-4 shadow-lift sm:left-6">
              <p className="text-xs font-semibold">Ce que voient les organisateurs</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>Métier, ville et rayon d'intervention</li>
                <li>Prestations et fourchette tarifaire</li>
                <li>Disponibilités compatibles avec leur date</li>
                <li>Avis publiés, liés à une demande réelle</li>
              </ul>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <VerificationBadge level={2} />
                <VerificationBadge level={4} />
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <Section className="pt-12">
        <Container size="wide">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Votre fiche en cinq étapes, dix minutes</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Chaque étape est enregistrée. Vous pouvez vous arrêter et reprendre plus tard.</p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {ONBOARDING.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border bg-card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-sage-soft font-heading text-sm font-semibold text-sage-deep dark:text-foreground" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="wide" className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div>
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Des fiches comme la vôtre</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Voici comment une fiche apparaît dans les résultats de l'annuaire.</p>
            {featured.some((p) => p.isDemo) && (
              <p className="mt-3">
                <DemoLabel>Fiches de démonstration — professionnels fictifs</DemoLabel>
              </p>
            )}
            {featured.length > 0 ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {featured.map((p) => (
                  <li key={p.id}>
                    <ProfessionalCard professional={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 rounded-3xl bg-card p-6">
                <CameraScene className="mx-auto max-w-xs" />
                <p className="mt-2 text-center text-sm text-muted-foreground">Aucune fiche publiée pour l'instant : la vôtre pourrait être la première.</p>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Les demandes que vous recevez</h2>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">Un organisateur remplit cinq champs depuis votre fiche. Vous recevez une demande complète, à laquelle vous répondez par e-mail depuis votre espace.</p>
            <InquiryExample className="mt-6" professionalName={featured[0]?.displayName} categoryName={featured[0]?.categoryName} />
            <InquiryScene className="mx-auto mt-6 hidden max-w-xs lg:block" />
          </div>
        </Container>
      </Section>

      <Section>
        <Container size="wide" className="space-y-8">
          <h2 className="font-heading text-3xl font-semibold text-balance">Tout ce dont vous avez besoin pour travailler sereinement</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <li key={b.title}>
                <Card className="h-full gap-3 p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <b.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{b.text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="verification" className="bg-muted/40">
        <Container size="wide" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-14">
          <div className="space-y-4">
            <p className="text-sm font-medium text-primary">Vérifications</p>
            <h2 className="font-heading text-3xl font-semibold text-balance">Ce que nous vérifions — et ce que nous ne prétendons pas</h2>
            <p className="text-muted-foreground text-pretty">Chaque niveau correspond à un contrôle précis réalisé sur pièces par notre équipe. Nous ne délivrons aucun label ni certification, nous ne garantissons pas la qualité d'une prestation : nous disons simplement, honnêtement, ce qui a été vérifié et quand.</p>
            <CalendarScene className="hidden max-w-xs lg:block" />
          </div>
          <div className="space-y-4">
            <ol className="grid gap-4 sm:grid-cols-2">
              {VERIFICATION_KINDS.map((k, i) => (
                <li key={k}>
                  <Card className="h-full gap-2 p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                      <h3 className="font-semibold">{VERIFICATION_KIND_LABELS[k].label}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground text-pretty">{VERIFICATION_KIND_LABELS[k].meaning}</p>
                  </Card>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                Les justificatifs que vous transmettez (Kbis, attestation d'assurance, diplômes) sont lus uniquement par l'équipe de modération, jamais publiés ni envoyés par e-mail. Vous pouvez les retirer tant qu'ils n'ont pas été examinés.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col items-center gap-4 text-center">
          <h2 className="font-heading text-3xl font-semibold text-balance">Prêt à rejoindre l'annuaire ?</h2>
          <p className="max-w-xl text-muted-foreground text-pretty">Cinq étapes, dix minutes, enregistrées au fur et à mesure. Votre fiche est relue sous 48 h ouvrées.</p>
          <Button asChild size="lg" className="rounded-full">
            <Link href="/inscription?intent=professional">Créer ma fiche</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}
