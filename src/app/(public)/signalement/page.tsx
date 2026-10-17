import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/legal/report-form";
import { Container, Section } from "@/components/shared/section";
import { getActor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Signaler un contenu",
  description: "Signalez une fiche, un avis, un message ou un compte problématique. Sans compte, traité par l'équipe de modération.",
  alternates: { canonical: "/signalement" },
};

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const actor = await getActor();
  return (
    <>
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h1 className="text-4xl font-semibold text-balance">Signaler un contenu</h1>
            <p className="mt-4 leading-7 text-muted-foreground text-pretty">Une fiche trompeuse, un avis suspect, un message déplacé, un comportement dangereux : dites-le nous. Aucun compte n'est nécessaire.</p>
            <ol className="mt-8 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">1.</span>
                <span>Votre signalement ouvre un dossier de modération horodaté.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">2.</span>
                <span>L'équipe examine le contenu et peut le masquer pendant l'analyse.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">3.</span>
                <span>Une décision motivée est prise ; l'auteur peut la contester.</span>
              </li>
            </ol>
            <p className="mt-6 text-sm text-muted-foreground">
              Détails dans la{" "}
              <Link href="/signalement-procedure" className="font-medium text-primary underline underline-offset-4">
                procédure de signalement
              </Link>{" "}
              et la{" "}
              <Link href="/moderation" className="font-medium text-primary underline underline-offset-4">
                politique de modération
              </Link>
              . En cas de danger immédiat, appelez le 17 ou le 112.
            </p>
          </div>
          <ReportForm defaultEmail={actor?.email} />
        </Container>
      </Section>
    </>
  );
}
