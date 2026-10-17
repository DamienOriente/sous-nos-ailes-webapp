import { and, eq } from "drizzle-orm";
import { files, mediaAssets, professionalAvailability, professionalCategories, professionals, professionalServices, profileVersions, publicProfiles } from "@/db/schema";
import { ensurePublicProfile, toSnapshot } from "@/modules/pages/application/page-service";
import { defaultBlockFor, generateDefaultContent } from "@/modules/pages/domain/default-content";
import { bindMediaToContent, type MediaLibrary } from "@/modules/pages/domain/media-binding";
import { plainToRichText, SCHEMA_VERSION, type Block, type BlockType, type PageContent } from "@/modules/pages/domain/page-schema";
import { getTemplateOrDefault } from "@/modules/pages/templates/registry";
import { PRICE_UNITS, labelFor } from "@/modules/professionals/domain/listing-schema";
import type { SeedContext } from "./context";

/**
 * Demo public pages: one approved (published) version per demo professional,
 * template chosen per listing, content written from the listing and enriched
 * (FAQ by trade, indicative prices from the catalogue, gallery/hero bound to
 * the media library when the files seed already ran). Marie also gets an
 * in-progress draft on top of her published page.
 * Idempotent: re-running updates the published version in place.
 */
const TEMPLATE_BY_KEY: Record<string, string> = {
  marie: "nid-douillet",
  camille: "sauge-elegante",
  julien: "table-gourmande",
  helene: "champetre-pierre",
  theo: "nuit-electrique",
  ines: "panorama-photo",
  sofia: "ronde-enfantine",
  "petits-nuages": "poudre-rose",
  "nounou-fete": "minimal-ivoire",
  ribambelle: "confettis",
  "maison-oliviers": "nature-foret",
  "salle-capitole": "corporate-net",
  "table-garonne": "terrasse-azur",
  "douceurs-albi": "jardin-fleuri",
  "studio-lumiere": "galerie-noire",
  "dj-nova": "moderne-grille",
  "fleurs-sauvages": "boheme-lin",
  "makeup-perle": "lumiere-studio",
  "photobooth-sud": "atelier-creatif",
  "petites-mains": "nid-douillet",
  "quatuor-ondes": "velours-spectacle",
  "navettes-occitanes": "carnet-voyage",
  "atelier-papier": "editorial-luxe",
};

type Faq = Array<{ question: string; answer: string }>;

const FAQ_BY_CATEGORY: Record<string, Faq> = {
  "garde-enfants-evenementielle": [
    { question: "Combien d'enfants pouvez-vous accueillir ?", answer: "Jusqu'à 15 enfants avec deux intervenantes ; au-delà, nous renforçons l'équipe (une intervenante pour 6 enfants de plus de 3 ans, une pour 3 en dessous)." },
    { question: "Que faut-il prévoir sur le lieu ?", answer: "Une pièce ou un coin abrité, un point d'eau et une prise électrique. Tapis, jeux, matériel créatif, veilleuses et lits parapluie sont apportés." },
    { question: "Comment sont gérées les allergies et traitements ?", answer: "Via la fiche enfant de la plateforme, remplie par les parents et consultée uniquement par l'équipe présente le jour J. Rien n'est transmis par e-mail." },
    { question: "À partir de quel âge ?", answer: "Dès la naissance pour la garde simple ; les ateliers commencent à 3 ans." },
    { question: "Que se passe-t-il si la soirée se prolonge ?", answer: "Une intervenante reste jusqu'au départ du dernier enfant. Les heures supplémentaires sont convenues avec vous dans la soirée, au tarif indiqué sur le devis." },
    { question: "Les enfants peuvent-ils rejoindre leurs parents pour certains moments ?", answer: "Oui : cérémonie, entrée des mariés, gâteau… vous nous indiquez les moments où les enfants doivent être avec vous et nous les accompagnons." },
  ],
  "baby-sitting": [
    { question: "Combien d'enfants par baby-sitter ?", answer: "Six enfants de plus de 3 ans par intervenante, trois en dessous. Nous restons volontairement sur de petits groupes." },
    { question: "Jusqu'à quelle heure ?", answer: "Jusqu'au départ du dernier enfant, même après 4 h du matin, au tarif horaire indiqué." },
    { question: "Fournissez-vous les lits pour la nuit ?", answer: "Oui : lits parapluie, draps et veilleuses. Prévoyez seulement les doudous et les pyjamas." },
    { question: "Comment transmettre les consignes des parents ?", answer: "Chaque famille remplit la fiche de son enfant sur la plateforme (rituels, allergies, contacts) ; nous l'ouvrons le jour J uniquement." },
  ],
  "animation-enfants": [
    { question: "À partir de quel âge ?", answer: "Dès 3 ans pour les ateliers, dès 5 ans pour les grands jeux et les chasses au trésor." },
    { question: "Combien d'animateurs ?", answer: "Un animateur pour 8 enfants ; deux animateurs minimum au-delà de 12 enfants." },
    { question: "Que faut-il prévoir sur place ?", answer: "Un coin abrité et une prise électrique. Tout le matériel est apporté, y compris les tables d'atelier." },
    { question: "Les animations fonctionnent-elles en intérieur ?", answer: "Oui, le programme est adapté à l'espace disponible : les grands jeux en bois et le spectacle tiennent dans 30 m²." },
    { question: "Animez-vous aussi les adultes ?", answer: "Le spectacle de clôture est pensé pour être regardé par les parents ; pour une animation adultes, parlons-en dans votre demande." },
  ],
  "wedding-planner": [
    { question: "Combien de mariages par an ?", answer: "Une quinzaine, pour garder le temps de connaître chaque couple et d'être disponible le jour J." },
    { question: "Travaillez-vous avec vos propres prestataires ?", answer: "Je propose des professionnels de confiance mais vous restez libres ; je ne touche aucune commission." },
    { question: "À quel moment vous contacter ?", answer: "Idéalement 12 à 18 mois avant la date pour une organisation complète ; une coordination du jour J peut se décider trois mois avant." },
    { question: "Comment sont fixés vos honoraires ?", answer: "Au forfait, précisé dès le devis, sans pourcentage sur le budget du mariage." },
    { question: "Gérez-vous l'espace enfants ?", answer: "Oui, la garde et l'animation des enfants sont intégrées au planning et coordonnées avec les équipes dédiées." },
  ],
  traiteur: [
    { question: "Proposez-vous une dégustation ?", answer: "Oui, offerte à partir de 80 convives, sur le menu pressenti ; en dessous, elle est facturée puis déduite du devis." },
    { question: "Gérez-vous les régimes particuliers ?", answer: "Oui, à partir de la liste des invités : végétarien, végan, sans gluten, allergies avec protocole écrit en cuisine." },
    { question: "Le service est-il compris ?", answer: "Service en salle, vaisselle, nappage et nettoyage de l'office sont inclus dans toutes les formules ; le devis précise le nombre de serveurs." },
    { question: "Y a-t-il un menu pour les enfants ?", answer: "Oui, servi avant les adultes pour que les parents dînent tranquilles, adapté aux allergies déclarées." },
    { question: "Pouvez-vous cuisiner sur place ?", answer: "Oui dès qu'une cuisine ou un office est disponible ; sinon nous venons avec notre cuisine mobile." },
  ],
  patissier: [
    { question: "Proposez-vous une dégustation ?", answer: "Oui, trois parfums à l'atelier, offerte pour toute pièce montée ou wedding cake." },
    { question: "Livrez-vous et montez-vous sur place ?", answer: "Oui, dans un rayon de 90 km ; le montage se fait une heure avant le service." },
    { question: "Avez-vous des options sans gluten ou sans lactose ?", answer: "Oui sur toutes les créations, sans supplément." },
    { question: "Combien de parts prévoir ?", answer: "Une part par invité pour une pièce montée ; comptez 20 % de moins si un dessert est déjà servi." },
  ],
  "domaine-reception": [
    { question: "Jusqu'à quelle heure la musique est-elle autorisée ?", answer: "4 h en intérieur, 1 h en extérieur, par respect pour le voisinage." },
    { question: "Le traiteur est-il imposé ?", answer: "Non, une visite technique suffit ; la cuisine professionnelle est à sa disposition." },
    { question: "Y a-t-il un espace pour les enfants ?", answer: "Oui, une salle de jeux attenante, fermée et visible depuis la salle de réception, avec une pelouse clôturée." },
    { question: "Combien de couchages ?", answer: "32 couchages répartis dans la maison de maître et les dépendances, inclus dans la location du week-end." },
    { question: "Le lieu est-il accessible aux personnes à mobilité réduite ?", answer: "Oui sur tout le rez-de-chaussée, avec sanitaires adaptés et parking à proximité immédiate." },
    { question: "Peut-on visiter ?", answer: "Oui, sur rendez-vous le samedi matin ou en semaine ; indiquez vos disponibilités dans la demande." },
  ],
  "salle-evenementielle": [
    { question: "La salle est-elle modulable ?", answer: "Oui : plénière de 200 places ou trois salles de sous-commission, reconfigurées en 30 minutes par notre équipe." },
    { question: "La régie audiovisuelle est-elle comprise ?", answer: "Oui, avec un technicien présent toute la journée ; la captation vidéo est en option." },
    { question: "Le traiteur est-il libre ?", answer: "Oui, l'office équipé est à sa disposition." },
    { question: "Comment venir ?", answer: "Métro à 100 m, parking public à 200 m, accès PMR par l'entrée principale." },
  ],
  dj: [
    { question: "Prenez-vous les demandes des invités ?", answer: "Oui, dans le cadre défini ensemble lors du brief musical (vos incontournables, vos interdits)." },
    { question: "Jusqu'à quelle heure ?", answer: "Jusqu'à 3 h dans la formule standard, 4 h dans la formule complète ; supplément horaire au-delà." },
    { question: "Le matériel est-il compris ?", answer: "Oui : sonorisation adaptée à la salle, éclairage d'ambiance et micro HF pour les discours." },
    { question: "Pouvez-vous sonoriser la cérémonie en extérieur ?", answer: "Oui, avec des enceintes sur batterie et un micro pour l'officiant et les lectures." },
    { question: "Que se passe-t-il s'il pleut ?", answer: "Une visite technique en amont permet de prévoir un plan B sonore pour la cérémonie et le cocktail." },
  ],
  musicien: [
    { question: "Avez-vous besoin d'électricité ?", answer: "Pour la cérémonie non ; pour le cocktail, une prise 16 A suffit." },
    { question: "Pouvez-vous jouer un morceau qui n'est pas dans votre répertoire ?", answer: "Oui, un arrangement sur mesure est proposé pour l'entrée ou la première danse." },
    { question: "Combien de temps à l'avance réserver ?", answer: "Six à douze mois pour un samedi de mai à septembre." },
    { question: "Jouez-vous en extérieur ?", answer: "Oui, à l'abri du soleil direct et de la pluie pour protéger les instruments." },
  ],
  photographe: [
    { question: "Quand reçoit-on les photos ?", answer: "Une sélection sous une semaine, la galerie complète sous six semaines." },
    { question: "Travaillez-vous en duo ?", answer: "Un second photographe est possible au-delà de 120 invités ou pour couvrir deux lieux de préparatifs." },
    { question: "Les photos sont-elles retouchées ?", answer: "Oui, chaque photo livrée est développée et retouchée ; les fichiers HD sont fournis sans logo." },
    { question: "Publiez-vous les photos des enfants ?", answer: "Jamais sans l'accord écrit des parents, recueilli via la plateforme." },
    { question: "Que se passe-t-il en cas d'empêchement ?", answer: "Un réseau de photographes de confiance prend le relais, prévenu dès la signature." },
  ],
  videaste: [
    { question: "Quand reçoit-on le film ?", answer: "Un teaser sous 48 h, le film long sous douze semaines." },
    { question: "Utilisez-vous un drone ?", answer: "Oui, par un télépilote déclaré, quand la réglementation du lieu le permet." },
    { question: "Quelles musiques sont utilisées ?", answer: "Des titres que vous choisissez avec nous, sous licence, pour que le film puisse être partagé." },
    { question: "Êtes-vous discrets ?", answer: "Deux personnes, pas d'éclairage additionnel, et une coordination avec le photographe pour ne jamais se gêner." },
  ],
  fleuriste: [
    { question: "D'où viennent les fleurs ?", answer: "De producteurs français, de saison ; pas de mousse florale." },
    { question: "Installez-vous sur place ?", answer: "Oui, le matin du mariage ; l'arche et les centres de table sont posés avant l'arrivée des invités." },
    { question: "Que deviennent les fleurs le lendemain ?", answer: "Elles sont offertes aux invités ou compostées, selon votre choix." },
    { question: "Proposez-vous des couronnes pour les enfants ?", answer: "Oui, réalisées en atelier avec les enfants d'honneur la veille quand c'est possible." },
  ],
  maquilleur: [
    { question: "L'essai est-il compris ?", answer: "Oui dans le forfait mariée, deux heures en amont pour tester teint et coiffure." },
    { question: "Vous déplacez-vous ?", answer: "Oui, à domicile ou sur le lieu de réception, dans un rayon de 70 km." },
    { question: "Le maquillage tient-il toute la journée ?", answer: "Oui avec des produits longue tenue ; une présence pour les retouches avant le bal est possible." },
    { question: "Maquillez-vous les enfants ?", answer: "Oui, avec des produits adaptés à leur peau." },
  ],
  "location-photobooth": [
    { question: "L'impression est-elle illimitée ?", answer: "Oui pendant toute la durée de location, papier et encre fournis." },
    { question: "Faut-il quelqu'un pour la faire fonctionner ?", answer: "Non : un technicien installe la borne, forme un invité volontaire et reste joignable." },
    { question: "Les photos sont-elles disponibles en ligne ?", answer: "Oui, dans une galerie privée le lendemain." },
    { question: "Quelle place prévoir ?", answer: "Deux mètres sur deux et une prise électrique." },
  ],
  transport: [
    { question: "Fournissez-vous des sièges enfants ?", answer: "Oui, sur demande, en précisant les âges dans votre demande." },
    { question: "Jusqu'à quelle heure assurez-vous les retours ?", answer: "Jusqu'à 5 h du matin, en rotations de 30 minutes." },
    { question: "Les chauffeurs connaissent-ils les lieux ?", answer: "Un repérage est fait avant chaque évènement pour les domaines isolés." },
    { question: "Peut-on décorer les véhicules ?", answer: "Oui pour les voitures de collection, en accord avec le chauffeur." },
  ],
  decorateur: [
    { question: "Travaillez-vous à partir d'un moodboard ?", answer: "Oui, c'est le point de départ de chaque projet." },
    { question: "Installez-vous et démontez-vous ?", answer: "Oui, la veille ou le matin, et le lendemain." },
    { question: "Fournissez-vous la papeterie ?", answer: "Oui : faire-part, menus, marque-places et signalétique assortis." },
    { question: "Quel délai prévoir ?", answer: "Trois mois pour la papeterie, six pour une scénographie complète." },
  ],
};

const GALLERY_HEADING: Record<string, string> = {
  "garde-enfants-evenementielle": "L'espace enfants en images",
  "baby-sitting": "En images",
  "animation-enfants": "Les animations en images",
  "wedding-planner": "Mariages coordonnés",
  traiteur: "À table",
  patissier: "Créations",
  "domaine-reception": "Le domaine",
  "salle-evenementielle": "Les espaces",
  dj: "Sur la piste",
  musicien: "En concert",
  photographe: "Extraits de reportages",
  videaste: "Images extraites des films",
  fleuriste: "Compositions",
  maquilleur: "Réalisations",
  "location-photobooth": "Les bornes en situation",
  transport: "Les véhicules",
  decorateur: "Scénographies",
};

const CTA_BY_CATEGORY: Record<string, { title: string; text: string; button: string }> = {
  "garde-enfants-evenementielle": { title: "Parlons de vos petits invités", text: "Dites-nous la date, le lieu et le nombre d'enfants : devis gratuit sous 48 h.", button: "Demander un devis" },
  "baby-sitting": { title: "Une soirée sereine pour les parents", text: "Décrivez votre évènement et les âges des enfants ; nous vous répondons sous 48 h.", button: "Demander un devis" },
  "animation-enfants": { title: "Et si les enfants avaient leur fête à eux ?", text: "Un programme sur mesure selon les âges et le lieu, devis sous 48 h.", button: "Demander un devis" },
  "wedding-planner": { title: "Commençons par une rencontre", text: "Un premier rendez-vous sans engagement pour comprendre votre mariage.", button: "Prendre rendez-vous" },
  traiteur: { title: "Composons votre menu", text: "Nombre de convives, style de réception, régimes particuliers : nous revenons vers vous avec une proposition chiffrée.", button: "Demander un devis" },
  "domaine-reception": { title: "Venez visiter le domaine", text: "Indiquez votre date et le nombre d'invités, nous vous proposons une visite.", button: "Vérifier une date" },
  dj: { title: "Vérifions la date", text: "Les samedis de mai à septembre partent vite : réservez votre créneau.", button: "Demander un devis" },
  photographe: { title: "Votre date est-elle libre ?", text: "Une date, un lieu, et nous vous répondons sous 48 h avec une proposition.", button: "Demander un devis" },
};

function ctaProps(categorySlug: string): { title: string; text: string; buttonLabel: string } {
  const c = CTA_BY_CATEGORY[categorySlug] ?? { title: "Parlons de votre évènement", text: "Un devis gratuit, une réponse rapide, aucune obligation.", button: "Demander un devis" };
  return { title: c.title, text: c.text, buttonLabel: c.button };
}

function ctaBlock(categorySlug: string): Block {
  return { id: "blk-cta_quote", type: "cta_quote", hidden: false, props: ctaProps(categorySlug) };
}

/** Sections every demo page must show, inserted before the contact block when the template does not list them. */
const REQUIRED: BlockType[] = ["gallery", "testimonials", "faq", "zone", "availability", "cta_quote", "trust"];

type ServiceRow = { name: string; priceCents: number | null; priceUnit: string | null; description: string | null };

function enrich(content: PageContent, categorySlug: string, snapshot: ReturnType<typeof toSnapshot>, services: ServiceRow[], hasAvailability: boolean): PageContent {
  const faq = FAQ_BY_CATEGORY[categorySlug];
  const priced = services.filter((s): s is ServiceRow & { priceCents: number } => typeof s.priceCents === "number" && s.priceCents > 0).slice(0, 4);
  const withRequired: PageContent = [...content];
  for (const type of REQUIRED) {
    if (withRequired.some((b) => b.type === type)) continue;
    if (type === "availability" && !hasAvailability) continue;
    const block = type === "cta_quote" ? ctaBlock(categorySlug) : defaultBlockFor(type, snapshot);
    const contactIndex = withRequired.findIndex((b) => b.type === "contact");
    withRequired.splice(contactIndex === -1 ? withRequired.length : contactIndex, 0, block);
  }
  return withRequired.map((b): Block => {
    switch (b.type) {
      case "hero":
        return { ...b, props: { ...b.props, subtitle: snapshot.tagline ?? b.props.subtitle, cta: { label: CTA_BY_CATEGORY[categorySlug]?.button ?? "Demander un devis", action: "quote" } } };
      case "about":
        return { ...b, props: { ...b.props, heading: categorySlug === "domaine-reception" || categorySlug === "salle-evenementielle" ? "Le lieu" : "Notre approche" } };
      case "services":
        return { ...b, props: { ...b.props, heading: "Prestations", intro: "Chaque prestation est décrite avec son tarif indicatif ; le devis s'ajuste à votre évènement." } };
      case "faq":
        return faq ? { ...b, props: { ...b.props, items: faq.slice(0, 6) } } : b;
      case "pricing":
        return priced.length > 0
          ? { ...b, props: { ...b.props, items: priced.map((s) => ({ label: s.name.slice(0, 80), priceCents: s.priceCents, unit: labelFor(PRICE_UNITS, s.priceUnit) || undefined })) } }
          : { ...b, hidden: true };
      case "gallery":
        return { ...b, props: { ...b.props, heading: GALLERY_HEADING[categorySlug] ?? "En images" } };
      case "testimonials":
        return { ...b, props: { ...b.props, heading: "Ce que disent les organisateurs" } };
      case "cta_quote":
        return { ...b, props: ctaProps(categorySlug) };
      case "availability":
        return { ...b, props: { ...b.props, heading: "Disponibilités habituelles", note: "Créneaux indicatifs : confirmez votre date dans la demande, une réponse vous est envoyée sous 48 h." } };
      case "zone":
        return { ...b, props: { ...b.props, note: snapshot.interventionRadiusKm > 0 ? `Déplacement inclus dans un rayon de ${Math.min(snapshot.interventionRadiusKm, 30)} km ; au-delà, frais précisés sur le devis.` : "Accueil sur place uniquement." } };
      default:
        return b;
    }
  });
}

async function mediaLibraryOf(ctx: SeedContext, professionalId: string): Promise<MediaLibrary | null> {
  const assets = await ctx.db
    .select({ fileId: mediaAssets.fileId, kind: mediaAssets.kind, alt: mediaAssets.alt, caption: mediaAssets.caption })
    .from(mediaAssets)
    .innerJoin(files, eq(files.id, mediaAssets.fileId))
    .where(and(eq(mediaAssets.professionalId, professionalId), eq(files.status, "clean")))
    .orderBy(mediaAssets.sortOrder);
  const cover = assets.find((a) => a.kind === "cover") ?? null;
  const gallery = assets.filter((a) => a.kind === "gallery").map((a) => ({ fileId: a.fileId, alt: a.alt, caption: a.caption }));
  if (!cover && gallery.length === 0) return null;
  return { cover: cover ? { fileId: cover.fileId, alt: cover.alt } : null, gallery };
}

export async function seed(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  for (const [key, professionalId] of Object.entries(ctx.professionals)) {
    const [row] = await db
      .select({ pro: professionals, cat: professionalCategories })
      .from(professionals)
      .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
      .where(eq(professionals.id, professionalId))
      .limit(1);
    if (!row) continue;
    const { pro, cat } = row;
    const templateKey = getTemplateOrDefault(TEMPLATE_BY_KEY[key] ?? cat.suggestedTemplates[0]).key;
    const template = getTemplateOrDefault(templateKey);
    const snapshot = toSnapshot(pro, cat);
    const services = await db
      .select({ name: professionalServices.name, priceCents: professionalServices.priceCents, priceUnit: professionalServices.priceUnit, description: professionalServices.description })
      .from(professionalServices)
      .where(and(eq(professionalServices.professionalId, professionalId), eq(professionalServices.isActive, true)))
      .orderBy(professionalServices.sortOrder);
    const hasAvailability = (await db.select({ id: professionalAvailability.id }).from(professionalAvailability).where(eq(professionalAvailability.professionalId, professionalId)).limit(1)).length > 0;
    const library = await mediaLibraryOf(ctx, professionalId);
    const baseContent = enrich(generateDefaultContent(snapshot, templateKey), cat.slug, snapshot, services, hasAvailability);
    const content = library ? bindMediaToContent(baseContent, library) : baseContent;

    const { publicProfileId } = await ensurePublicProfile(professionalId, templateKey, db);
    const [profile] = await db.select().from(publicProfiles).where(eq(publicProfiles.id, publicProfileId)).limit(1);
    if (!profile) continue;
    const seo = {
      seoTitle: `${pro.displayName} – ${cat.name}${pro.city ? ` à ${pro.city}` : ""}`.slice(0, 65),
      seoDescription: (pro.tagline ?? pro.description ?? "").slice(0, 160) || null,
    };

    // Only listings the professionals seed marked as published get a live version.
    if (pro.status === "published") {
      let publishedId = profile.publishedVersionId;
      if (!publishedId) {
        const [v] = await db
          .insert(profileVersions)
          .values({
            publicProfileId,
            versionNumber: 1,
            status: "approved",
            templateKey,
            schemaVersion: SCHEMA_VERSION,
            theme: { palette: template.palettes[0]?.key },
            content,
            ...seo,
            submittedAt: ctx.now,
            reviewedAt: ctx.now,
            reviewedByUserId: ctx.users.moderator ?? null,
            reviewNote: "Validé (données de démonstration).",
            createdByUserId: pro.ownerUserId,
          })
          .onConflictDoUpdate({ target: [profileVersions.publicProfileId, profileVersions.versionNumber], set: { status: "approved", content, templateKey, ...seo, updatedAt: ctx.now } })
          .returning({ id: profileVersions.id });
        publishedId = v?.id ?? null;
      } else {
        await db.update(profileVersions).set({ content, templateKey, theme: { palette: template.palettes[0]?.key }, status: "approved", ...seo, updatedAt: ctx.now }).where(eq(profileVersions.id, publishedId));
      }
      await db
        .update(publicProfiles)
        .set({ publishedVersionId: publishedId, draftVersionId: profile.draftVersionId ?? publishedId, isIndexable: !pro.isDemo, slug: pro.slug, updatedAt: ctx.now })
        .where(eq(publicProfiles.id, publicProfileId));
      // The v1 created by ensurePublicProfile becomes the published one: no separate draft unless asked below.
      if (profile.draftVersionId && profile.draftVersionId !== publishedId) {
        const [draft] = await db.select({ id: profileVersions.id, status: profileVersions.status }).from(profileVersions).where(eq(profileVersions.id, profile.draftVersionId)).limit(1);
        if (draft && draft.status === "draft" && key !== "marie") {
          await db.delete(profileVersions).where(eq(profileVersions.id, draft.id));
          await db.update(publicProfiles).set({ draftVersionId: publishedId }).where(eq(publicProfiles.id, publicProfileId));
        }
      }
    } else {
      // Unpublished listing: keep the generated draft, make sure it has the richer content.
      if (profile.draftVersionId) await db.update(profileVersions).set({ content, templateKey, ...seo, updatedAt: ctx.now }).where(eq(profileVersions.id, profile.draftVersionId));
    }

    // Marie: a work-in-progress draft (v2) on top of her published page.
    if (key === "marie" && pro.status === "published") {
      const [current] = await db.select().from(publicProfiles).where(eq(publicProfiles.id, publicProfileId)).limit(1);
      const existingDraft = current?.draftVersionId && current.draftVersionId !== current.publishedVersionId ? current.draftVersionId : null;
      const draftContent: PageContent = content.map((b): Block =>
        b.type === "about"
          ? { ...b, props: { ...b.props, body: plainToRichText(`${pro.description ?? ""}\n\nNouveauté 2027 : un atelier « petits pâtissiers » pour les 6-12 ans pendant le dîner des grands.`) } }
          : b.type === "faq"
            ? { ...b, props: { ...b.props, items: [...b.props.items.slice(0, 5), { question: "Proposez-vous une veilleuse de nuit ?", answer: "Oui, pour les mariages qui se prolongent : une animatrice reste jusqu'au départ du dernier enfant." }] } }
            : b,
      );
      if (existingDraft) {
        await db.update(profileVersions).set({ content: draftContent, status: "draft", updatedAt: ctx.now }).where(eq(profileVersions.id, existingDraft));
      } else {
        const [v2] = await db
          .insert(profileVersions)
          .values({ publicProfileId, versionNumber: 2, status: "draft", templateKey, schemaVersion: SCHEMA_VERSION, theme: { palette: template.palettes[0]?.key }, content: draftContent, ...seo, createdByUserId: pro.ownerUserId })
          .onConflictDoUpdate({ target: [profileVersions.publicProfileId, profileVersions.versionNumber], set: { content: draftContent, status: "draft", updatedAt: ctx.now } })
          .returning({ id: profileVersions.id });
        if (v2) await db.update(publicProfiles).set({ draftVersionId: v2.id }).where(eq(publicProfiles.id, publicProfileId));
      }
    }
  }
}
