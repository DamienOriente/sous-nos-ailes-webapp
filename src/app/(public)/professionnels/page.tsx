import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, Inbox, LayoutTemplate, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, Section } from "@/components/shared/section";
import { VerificationBadge } from "@/components/directory/verification-badge";
import { env } from "@/lib/env";
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

export default function ProfessionalsLandingPage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-sage-soft/40 to-background">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Vous êtes professionnel ?</p>
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
            <p className="text-xs text-muted-foreground">Sans engagement. Offre Premium optionnelle (19,90 € TTC / mois) pour la bibliothèque complète de modèles, les statistiques et les outils avancés.</p>
          </div>
          <Card className="gap-4 p-6">
            <p className="text-sm font-semibold">Ce que voient les organisateurs sur votre fiche</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>· Métier, ville et rayon d'intervention</li>
              <li>· Prestations principales et fourchette tarifaire indicative</li>
              <li>· Disponibilités compatibles avec leur date</li>
              <li>· Niveau de vérification, détaillé au survol</li>
              <li>· Avis publiés, liés à une demande réelle</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <VerificationBadge level={2} />
              <VerificationBadge level={4} />
              <VerificationBadge level={5} />
            </div>
          </Card>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-8">
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
        <Container className="space-y-8">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Vérifications</p>
            <h2 className="font-heading text-3xl font-semibold text-balance">Ce que nous vérifions — et ce que nous ne prétendons pas</h2>
            <p className="text-muted-foreground text-pretty">Chaque niveau correspond à un contrôle précis réalisé sur pièces par notre équipe. Nous ne délivrons aucun label ni certification, nous ne garantissons pas la qualité d'une prestation : nous disons simplement, honnêtement, ce qui a été vérifié et quand.</p>
          </div>
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
