import type { Metadata } from "next";
import Link from "next/link";
import { LetterScene } from "@/components/illustrations/public-scenes";
import { ContactForm } from "@/components/legal/contact-form";
import { Container, Section } from "@/components/shared/section";
import { getActor } from "@/lib/session";
import { getContactEmail } from "@/modules/legal/application/legal-pages";

export const metadata: Metadata = {
  title: "Contact",
  description: "Écrire à l'équipe Sous Nos Ailes : question sur le service, accessibilité, presse, partenariat.",
  alternates: { canonical: "/contact" },
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const [actor, contactEmail] = await Promise.all([getActor(), getContactEmail()]);
  return (
    <>
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="rounded-[1.75rem] rounded-tr-[3.5rem] bg-ivory-deep/70 p-4 dark:bg-ivory-deep/50">
              <LetterScene className="mx-auto max-w-[15rem]" />
            </div>
            <h1 className="mt-6 text-4xl font-semibold text-balance">Nous écrire</h1>
            <p className="mt-4 leading-7 text-muted-foreground text-pretty">Une question sur le service, un partenariat, un obstacle d'accessibilité : ce formulaire arrive directement à l'équipe. Nous répondons par e-mail, généralement sous deux jours ouvrés.</p>
            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="font-semibold">Vos données personnelles</dt>
                <dd className="text-muted-foreground">
                  Export, rectification, suppression : passez par{" "}
                  <Link href="/app/compte/confidentialite" className="font-medium text-primary underline underline-offset-4">
                    votre espace
                  </Link>{" "}
                  ou lisez{" "}
                  <Link href="/droits-rgpd" className="font-medium text-primary underline underline-offset-4">
                    vos droits
                  </Link>
                  .
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Un contenu à signaler</dt>
                <dd className="text-muted-foreground">
                  Utilisez plutôt le{" "}
                  <Link href="/signalement" className="font-medium text-primary underline underline-offset-4">
                    formulaire de signalement
                  </Link>
                  , traité en priorité par la modération.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Urgence concernant un enfant</dt>
                <dd className="text-muted-foreground">Contactez immédiatement les services d'urgence (15, 17, 112). Ce formulaire n'est pas surveillé en continu.</dd>
              </div>
            </dl>
          </div>
          <div className="lg:pt-8">
            {contactEmail ? (
              <ContactForm defaultEmail={actor?.email} defaultName={actor?.name} />
            ) : (
              <p role="status" className="rounded-2xl border bg-card p-6 text-muted-foreground">
                Le formulaire de contact n'est pas encore activé : l'adresse de réception doit être renseignée par l'équipe dans les paramètres. Réessayez plus tard.
              </p>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
