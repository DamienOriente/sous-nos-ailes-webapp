import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/shared/section";

export const metadata: Metadata = {
  title: "Déclaration d'accessibilité",
  description: "État d'accessibilité de sousnosailes.fr : objectif WCAG 2.2 AA, site non encore audité, comment signaler un obstacle.",
  alternates: { canonical: "/accessibilite" },
};

export default function AccessibilityPage() {
  return (
    <>
      <Section>
        <Container size="narrow" className="space-y-10">
          <header>
            <h1 className="text-4xl font-semibold text-balance">Déclaration d'accessibilité</h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground text-pretty">
              Sous Nos Ailes vise la conformité au niveau AA des WCAG 2.2 (et au RGAA pour ce qui s'applique). Cette page décrit honnêtement où nous en sommes.
            </p>
          </header>

          <section aria-labelledby="etat">
            <h2 id="etat" className="text-2xl font-semibold">
              État de conformité : non audité
            </h2>
            <p className="mt-3 leading-7 text-pretty">
              Le site n'a pas encore fait l'objet d'un audit d'accessibilité par un tiers. Nous ne pouvons donc pas déclarer de taux de conformité. Des tests automatisés (axe-core) sont exécutés sur les pages principales à chaque modification et doivent ne relever aucune violation sérieuse ou critique ; ils ne remplacent pas un audit manuel.
            </p>
          </section>

          <section aria-labelledby="mesures">
            <h2 id="mesures" className="text-2xl font-semibold">
              Ce que nous faisons déjà
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
              <li>Structure sémantique (titres hiérarchisés, régions, listes), lien d'évitement vers le contenu.</li>
              <li>Formulaires avec étiquettes explicites, messages d'erreur annoncés, confirmation des actions destructives.</li>
              <li>Focus visible sur tous les éléments interactifs, navigation complète au clavier.</li>
              <li>Contrastes vérifiés sur la palette en mode clair et en mode sombre.</li>
              <li>Respect de la préférence « réduire les animations ».</li>
              <li>Pas de contenu uniquement transmis par la couleur ; icônes décoratives masquées des lecteurs d'écran.</li>
            </ul>
          </section>

          <section aria-labelledby="limites">
            <h2 id="limites" className="text-2xl font-semibold">
              Limites connues
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7">
              <li>L'éditeur visuel du plan de table repose sur le glisser-déposer ; une alternative clavier complète est prévue mais pas encore livrée.</li>
              <li>Les pages publiques des professionnels sont composées à partir de modèles ; les textes alternatifs des photos dépendent de ce que chaque professionnel renseigne.</li>
              <li>Certains documents téléchargés (devis, contrats) sont des fichiers fournis par des tiers, dont nous ne garantissons pas l'accessibilité.</li>
            </ul>
          </section>

          <section aria-labelledby="signaler">
            <h2 id="signaler" className="text-2xl font-semibold">
              Signaler un obstacle
            </h2>
            <p className="mt-3 leading-7 text-pretty">
              Si vous rencontrez une difficulté pour accéder à un contenu ou à une fonctionnalité, écrivez-nous via la{" "}
              <Link href="/contact" className="font-medium text-primary underline underline-offset-4">
                page contact
              </Link>{" "}
              en indiquant la page concernée, l'outil utilisé (lecteur d'écran, loupe, navigation clavier…) et le problème rencontré. Nous répondons et proposons une alternative dans les meilleurs délais.
            </p>
            <p className="mt-3 leading-7 text-muted-foreground text-pretty">
              Si vous n'obtenez pas de réponse satisfaisante, vous pouvez saisir le Défenseur des droits. [À COMPLÉTER : vérifier l'applicabilité du RGAA et les mentions obligatoires de la déclaration au regard du statut de l'éditeur.]
            </p>
          </section>

          <p className="text-sm text-muted-foreground">Dernière mise à jour de cette déclaration : octobre 2026.</p>
        </Container>
      </Section>
    </>
  );
}
