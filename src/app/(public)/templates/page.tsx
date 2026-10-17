import type { Metadata } from "next";
import Link from "next/link";
import { TemplateThumbnail } from "@/components/pages/template-thumbnail";
import { Container, Section } from "@/components/shared/section";
import { PageHeader } from "@/components/shared/page-header";
import { TEMPLATE_UNIVERSES, TEMPLATES } from "@/modules/pages/templates/registry";

export const metadata: Metadata = {
  title: "24 templates de page professionnelle",
  description: "Découvrez les 24 mises en page disponibles pour votre page professionnelle sur Sous Nos Ailes : élégant, champêtre, festif, photographique, corporate… Chaque template est responsive et accessible.",
};

/** Public gallery: every template rendered with a fictitious persona, grouped by universe. */
export default function TemplatesGalleryPage() {
  return (
    <Section>
      <Container size="wide" className="space-y-12">
        <PageHeader
          eyebrow="Pages professionnelles"
          title="24 mises en page, une seule qui vous ressemble"
          description="Chaque template change réellement la structure de la page : en-tête plein écran ou divisé, galerie mosaïque ou pellicule, navigation latérale ou ancrée. Les contenus ci-dessous sont fictifs ; six templates sont inclus dans l'offre gratuite, les autres dans Professionnel Premium."
        />
        {TEMPLATE_UNIVERSES.map((universe) => {
          const list = TEMPLATES.filter((t) => t.universe === universe);
          return (
            <section key={universe} aria-labelledby={`u-${universe}`} className="space-y-4">
              <h2 id={`u-${universe}`} className="text-xl font-semibold capitalize">
                {universe}
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <li key={t.key}>
                    <Link href={`/templates/${t.key}`} className="group block rounded-2xl border bg-card p-3 transition-shadow hover:shadow-lift focus-visible:outline-2">
                      <TemplateThumbnail templateKey={t.key} className="aspect-[4/3] w-full overflow-hidden rounded-xl border" />
                      <div className="mt-3 flex items-start justify-between gap-3 px-1">
                        <div>
                          <p className="font-semibold group-hover:underline">{t.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                        </div>
                        <span className={t.isFree ? "shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground" : "shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium"}>{t.isFree ? "Gratuit" : "Premium"}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </Container>
    </Section>
  );
}
