import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo";
import { Section } from "@/components/public/section";
import { Sprig } from "@/components/illustrations/botanical";
import { buttonClasses } from "@/components/ui/button";
import { LabelCard } from "@/components/ui/label-card";

export const metadata: Metadata = buildMetadata({ title: "Demande bien reçue", description: "Votre demande est enregistrée.", path: "/demander-un-devis/merci", noindex: true });

export default async function ThankYouPage({ searchParams }: PageProps<"/demander-un-devis/merci">) {
  const params = await searchParams;
  const reference = typeof params.ref === "string" && /^LPI-[A-Z0-9-]{4,}$/.test(params.ref) ? params.ref : null;
  const [settings, env] = await Promise.all([getSettings(), Promise.resolve(getEnv())]);
  return (
    <Section className="pt-12">
      <div className="mx-auto max-w-2xl">
        <Sprig kind="olive" size={72} />
        <h1 className="mt-4 font-display text-[2.5rem] leading-[1.08]">Votre demande est bien reçue</h1>
        {reference ? (
          <LabelCard className="mt-8" reference="Référence de votre demande" title={reference} />
        ) : null}
        <div className="prose-lpi mt-8">
          <p>Un accusé de réception vient de vous être envoyé par email, avec un lien pour suivre votre dossier dans votre espace. {settings.ownerFirstName} étudie votre demande et vous rappelle rapidement.</p>
          <p>Cette demande ne constitue pas une réservation : la prestation sera confirmée après votre accord sur la proposition et la constitution de l’équipe.</p>
          {env.DEMO_MODE ? (
            <p>
              Mode démonstration : l’email est consultable dans Mailpit sur{" "}
              <a href="http://localhost:8026" target="_blank" rel="noreferrer">
                localhost:8026
              </a>
              .
            </p>
          ) : null}
        </div>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/connexion" className={buttonClasses()}>
            Accéder à mon espace
          </Link>
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </Section>
  );
}
