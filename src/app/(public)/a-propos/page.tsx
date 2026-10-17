import type { Metadata } from "next";
import Link from "next/link";
import { Feather } from "@/components/marketing/illustrations";
import { Container, Section } from "@/components/shared/section";

export const metadata: Metadata = {
  title: "À propos",
  description: "Pourquoi Sous Nos Ailes existe, ce que la plateforme fait et ne fait pas, et les engagements que nous prenons.",
  alternates: { canonical: "/a-propos" },
};

const COMMITMENTS = [
  { title: "Dire exactement ce qui a été vérifié", text: "Aucun label inventé. Les mentions de vérification décrivent des contrôles réels et nommés. Si nous n'avons rien contrôlé, la fiche le dit." },
  { title: "Traiter les données des enfants comme des données rares", text: "Le minimum nécessaire à la garde, chiffré, visible de la seule équipe concernée, anonymisé après l'évènement." },
  { title: "Rester un outil, pas un employeur", text: "Les professionnels sont indépendants. Nous ne fixons ni leurs prix ni leurs conditions ; nous facilitons la rencontre et la coordination." },
  { title: "Rendre le refus aussi simple que l'acceptation", text: "Pour les cookies comme pour les abonnements : résiliation en ligne, pas de case pré-cochée, pas de relance culpabilisante." },
];

export default function AboutPage() {
  return (
    <>
      <Section>
        <Container size="narrow">
          <h1 className="text-4xl font-semibold text-balance sm:text-5xl">Des ailes pour les évènements où il y a des enfants</h1>
          <div className="mt-8 space-y-5 text-lg leading-8 text-pretty">
            <p>
              Un mariage, un baptême, un séminaire d'entreprise avec les familles : il y a presque toujours des enfants, et presque jamais quelqu'un dont c'est le métier de s'en occuper. Les parents alternent entre la table et le coin jeux, les organisateurs improvisent, et la fête se vit à moitié.
            </p>
            <p>
              Sous Nos Ailes part de là. La plateforme met en avant les professionnels de la garde d'enfants et de l'animation, puis tous les métiers de l'évènementiel autour d'eux, et donne à l'organisateur un espace unique pour coordonner tout ce monde : planning, invités, prestataires, messagerie, espace enfants.
            </p>
            <p>
              Nous sommes une petite équipe. Le service est en phase de lancement : les fiches de démonstration sont signalées comme telles, les documents juridiques sont des brouillons en cours de validation, et nous préférons dire ce que nous ne faisons pas encore plutôt que de le promettre.
            </p>
          </div>
        </Container>
      </Section>
      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container size="narrow">
          <h2 className="text-3xl font-semibold">Nos engagements</h2>
          <ul className="mt-8 space-y-7">
            {COMMITMENTS.map((c) => (
              <li key={c.title} className="flex gap-4">
                <Feather className="mt-1 size-5 shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold">{c.title}</h3>
                  <p className="mt-1 leading-7 text-muted-foreground text-pretty">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <Section>
        <Container size="narrow">
          <h2 className="text-3xl font-semibold">Ce que nous ne sommes pas</h2>
          <ul className="mt-6 space-y-3 leading-7 text-muted-foreground">
            <li>Ni une agence de garde d'enfants, ni un employeur : chaque professionnel exerce sous sa propre responsabilité et ses propres assurances.</li>
            <li>Ni un intermédiaire de paiement entre organisateurs et prestataires : les abonnements payants ne concernent que les outils de la plateforme.</li>
            <li>Ni un organisme de certification : nos niveaux de vérification décrivent des contrôles documentaires, pas une garantie de qualité.</li>
          </ul>
          <p className="mt-8 text-muted-foreground">
            L'éditeur, l'hébergeur et les contacts officiels figurent dans les{" "}
            <Link href="/mentions-legales" className="font-medium text-primary underline underline-offset-4">
              mentions légales
            </Link>
            . Pour nous écrire :{" "}
            <Link href="/contact" className="font-medium text-primary underline underline-offset-4">
              page contact
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
