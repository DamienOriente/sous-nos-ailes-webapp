import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { env } from "@/lib/env";
import type { DirectoryCard } from "@/modules/directory/application/directory-search";

export type GeoContext = { kind: "department" | "city"; name: string; slug: string } | null;

/** "Garde d'enfants évènementielle à Toulouse" / "en Haute-Garonne" / "en France". */
export function geoTitle(categoryName: string, geo: GeoContext): string {
  if (!geo) return `${categoryName} : professionnels vérifiés en France`;
  if (geo.kind === "city") return `${categoryName} à ${geo.name}`;
  const name = geo.name;
  const prep = /^(Haut|Bas|Nord|Pas|Lot|Loir|Cher|Gard|Gers|Jura|Var|Tarn|Rhône|Doubs|Calvados|Cantal|Finistère|Loiret|Morbihan|Puy|Territoire|Val-d|Val-de)/i.test(name) && !/^(Haute|Hautes)/.test(name) ? "dans le " : /^(Alpes|Ardennes|Bouches|Côtes|Deux|Hautes|Landes|Pyrénées|Vosges|Yvelines)/.test(name) ? "dans les " : /^(Ain|Aisne|Allier|Ariège|Aube|Aude|Aveyron|Eure|Hérault|Indre|Isère|Orne|Oise|Yonne)$/.test(name) ? "dans l'" : "en ";
  return `${categoryName} ${prep}${name}`;
}

export function CategoryIntro({ categoryDescription, isChildcare, geo, total }: { categoryName?: string; categoryDescription: string | null; isChildcare: boolean; geo: GeoContext; total: number }) {
  const where = geo ? (geo.kind === "city" ? `à ${geo.name}` : `dans le département ${geo.name}`) : "partout en France, avec une présence renforcée en Occitanie et Nouvelle-Aquitaine";
  return (
    <div className="max-w-3xl space-y-3 text-muted-foreground text-pretty">
      <p>
        {categoryDescription ? `${categoryDescription} ` : ""}
        {total > 0 ? `${total} professionnel${total > 1 ? "s" : ""} ${total > 1 ? "proposent" : "propose"} ce service ${where}.` : `Nous référençons des professionnels ${where}.`} Chaque fiche a été relue par notre équipe avant publication et indique précisément les vérifications effectuées (immatriculation, assurance, qualifications) — jamais une « certification ».
      </p>
      {isChildcare && <p>Pour la garde d'enfants, regardez le ratio d'encadrement déclaré, les tranches d'âge accueillies et les justificatifs examinés. Vous pourrez ensuite inscrire vos enfants et transmettre les consignes de manière sécurisée depuis votre évènement.</p>}
    </div>
  );
}

export function CategoryFaq({ categoryName, isChildcare, geo }: { categoryName: string; isChildcare: boolean; geo: GeoContext }) {
  const items = faqItems(categoryName, isChildcare, geo);
  return (
    <section aria-labelledby="faq-title" className="max-w-3xl space-y-3">
      <h2 id="faq-title" className="font-heading text-xl font-semibold">
        Questions fréquentes
      </h2>
      <Accordion type="single" collapsible>
        {items.map((f, i) => (
          <AccordionItem key={f.q} value={`q${i}`}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function faqItems(categoryName: string, isChildcare: boolean, geo: GeoContext): Array<{ q: string; a: string }> {
  const where = geo ? (geo.kind === "city" ? `à ${geo.name}` : `en ${geo.name}`) : "près de chez vous";
  const items = [
    { q: `Comment choisir un professionnel « ${categoryName} » ${where} ?`, a: "Comparez les prestations, la fourchette tarifaire, les disponibilités et le niveau de vérification. Contactez plusieurs professionnels avec le formulaire de leur fiche : la demande est transmise directement, sans intermédiaire." },
    { q: "Que signifient les niveaux de vérification ?", a: "« Identité renseignée », « Informations professionnelles contrôlées », « Justificatifs examinés », « Assurance vérifiée », « Qualifications vérifiées » décrivent des contrôles sur pièces réalisés par notre équipe. Ils ne constituent pas une certification officielle ni une garantie de la prestation." },
    { q: "La mise en relation est-elle payante ?", a: "Non. Les organisateurs contactent gratuitement les professionnels. Les résultats « Sponsorisé » sont clairement étiquetés et n'évincent jamais les résultats gratuits." },
  ];
  if (isChildcare) items.push({ q: "Comment sont protégées les informations sur mes enfants ?", a: "Le formulaire de contact ne collecte aucune donnée de santé. Après la mise en relation, l'organisateur inscrit les enfants dans son évènement : les informations sensibles sont chiffrées, accessibles uniquement aux personnes autorisées, et supprimées après l'évènement." });
  return items;
}

/** JSON-LD ItemList + BreadcrumbList for a category/geo page. */
export function CategoryJsonLd({ title, path, items, breadcrumbs }: { title: string; path: string; items: DirectoryCard[]; breadcrumbs: Array<{ name: string; path: string }> }) {
  const base = env.APP_URL;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    url: new URL(path, base).toString(),
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: new URL(`/pro/${p.slug}`, base).toString(),
      name: p.displayName,
    })),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: new URL(b.path, base).toString() })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
    </>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ name: string; path: string }> }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((b, i) => (
          <li key={b.path} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-foreground">
                {b.name}
              </span>
            ) : (
              <Link href={b.path} className="hover:text-foreground">
                {b.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
