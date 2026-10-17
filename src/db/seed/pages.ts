import { eq } from "drizzle-orm";
import { professionalCategories, professionals, profileVersions, publicProfiles } from "@/db/schema";
import { ensurePublicProfile, toSnapshot } from "@/modules/pages/application/page-service";
import { generateDefaultContent } from "@/modules/pages/domain/default-content";
import { plainToRichText, SCHEMA_VERSION, type Block, type PageContent } from "@/modules/pages/domain/page-schema";
import { getTemplateOrDefault } from "@/modules/pages/templates/registry";
import type { SeedContext } from "./context";

/**
 * Demo public pages: one approved (published) version per demo professional,
 * template chosen from the category's suggestions, content written from the
 * listing. Marie also gets an in-progress draft on top of her published page.
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
};

const FAQ_BY_CATEGORY: Record<string, Array<{ question: string; answer: string }>> = {
  "garde-enfants-evenementielle": [
    { question: "Combien d'enfants pouvez-vous accueillir ?", answer: "Jusqu'à 15 enfants avec deux animatrices ; au-delà, nous renforçons l'équipe (une animatrice pour 6 enfants de plus de 3 ans)." },
    { question: "Que faut-il prévoir sur le lieu ?", answer: "Une pièce ou un coin abrité et un point d'eau. Tapis, jeux, matériel créatif et veilleuses sont apportés." },
    { question: "Comment sont gérées les allergies et traitements ?", answer: "Via la fiche enfant de la plateforme, consultée uniquement par l'équipe présente le jour J." },
  ],
  "wedding-planner": [
    { question: "Combien de mariages par an ?", answer: "Une dizaine, pour garder le temps de connaître chaque couple." },
    { question: "Travaillez-vous avec vos propres prestataires ?", answer: "Je propose des professionnels de confiance mais vous restez libres ; je ne touche aucune commission." },
  ],
  traiteur: [
    { question: "Proposez-vous une dégustation ?", answer: "Oui, à partir de 80 convives, sur le menu pressenti." },
    { question: "Gérez-vous les régimes particuliers ?", answer: "Oui, à partir de la liste des invités : chacun mange la même belle chose, sans plat à part." },
  ],
  "domaine-reception": [
    { question: "Jusqu'à quelle heure la musique est-elle autorisée ?", answer: "4 h en intérieur, 1 h en extérieur." },
    { question: "Le traiteur est-il imposé ?", answer: "Non, une visite technique suffit." },
  ],
  dj: [
    { question: "Prenez-vous les demandes des invités ?", answer: "Oui, dans le cadre défini ensemble." },
    { question: "Jusqu'à quelle heure ?", answer: "Jusqu'à 4 h ; supplément horaire au-delà." },
  ],
  photographe: [
    { question: "Quand reçoit-on les photos ?", answer: "Une sélection sous une semaine, la galerie complète sous quatre semaines." },
    { question: "Travaillez-vous en duo ?", answer: "Possible au-delà de 120 invités." },
  ],
  "animation-enfants": [
    { question: "À partir de quel âge ?", answer: "Dès 3 ans pour les ateliers, dès 5 ans pour les grands jeux." },
    { question: "Combien d'animateurs ?", answer: "Un animateur pour 8 enfants." },
  ],
};

function enrich(content: PageContent, categorySlug: string, priceFromCents: number | null, priceUnit: string | null): PageContent {
  return content.map((b): Block => {
    if (b.type === "faq") return { ...b, props: { ...b.props, items: FAQ_BY_CATEGORY[categorySlug] ?? b.props.items } };
    if (b.type === "pricing" && priceFromCents) return { ...b, props: { ...b.props, items: [{ label: "Prestation type", priceCents: priceFromCents, unit: priceUnit ?? undefined }] } };
    return b;
  });
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
    const content = enrich(generateDefaultContent(snapshot, templateKey), cat.slug, pro.priceFromCents, pro.priceUnit);

    const { publicProfileId } = await ensurePublicProfile(professionalId, templateKey, db);
    const [profile] = await db.select().from(publicProfiles).where(eq(publicProfiles.id, publicProfileId)).limit(1);
    if (!profile) continue;

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
            seoTitle: `${pro.displayName} – ${cat.name}${pro.city ? ` à ${pro.city}` : ""}`.slice(0, 65),
            seoDescription: (pro.tagline ?? pro.description ?? "").slice(0, 160) || null,
            submittedAt: ctx.now,
            reviewedAt: ctx.now,
            reviewedByUserId: ctx.users.moderator ?? null,
            reviewNote: "Validé (données de démonstration).",
            createdByUserId: pro.ownerUserId,
          })
          .onConflictDoUpdate({ target: [profileVersions.publicProfileId, profileVersions.versionNumber], set: { status: "approved", content, templateKey, updatedAt: ctx.now } })
          .returning({ id: profileVersions.id });
        publishedId = v?.id ?? null;
      } else {
        await db.update(profileVersions).set({ content, templateKey, status: "approved", updatedAt: ctx.now }).where(eq(profileVersions.id, publishedId));
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
      if (profile.draftVersionId) await db.update(profileVersions).set({ content, templateKey, updatedAt: ctx.now }).where(eq(profileVersions.id, profile.draftVersionId));
    }

    // Marie: a work-in-progress draft (v2) on top of her published page.
    if (key === "marie" && pro.status === "published") {
      const [current] = await db.select().from(publicProfiles).where(eq(publicProfiles.id, publicProfileId)).limit(1);
      const existingDraft = current?.draftVersionId && current.draftVersionId !== current.publishedVersionId ? current.draftVersionId : null;
      const draftContent: PageContent = content.map((b): Block =>
        b.type === "about"
          ? { ...b, props: { ...b.props, body: plainToRichText(`${pro.description ?? ""}\n\nNouveauté 2027 : un atelier « petits pâtissiers » pour les 6-12 ans pendant le dîner des grands.`) } }
          : b.type === "faq"
            ? { ...b, props: { ...b.props, items: [...b.props.items, { question: "Proposez-vous une veilleuse de nuit ?", answer: "Oui, pour les mariages qui se prolongent : une animatrice reste jusqu'au départ du dernier enfant." }] } }
            : b,
      );
      if (existingDraft) {
        await db.update(profileVersions).set({ content: draftContent, status: "draft", updatedAt: ctx.now }).where(eq(profileVersions.id, existingDraft));
      } else {
        const [v2] = await db
          .insert(profileVersions)
          .values({ publicProfileId, versionNumber: 2, status: "draft", templateKey, schemaVersion: SCHEMA_VERSION, theme: { palette: template.palettes[0]?.key }, content: draftContent, createdByUserId: pro.ownerUserId })
          .onConflictDoUpdate({ target: [profileVersions.publicProfileId, profileVersions.versionNumber], set: { content: draftContent, status: "draft", updatedAt: ctx.now } })
          .returning({ id: profileVersions.id });
        if (v2) await db.update(publicProfiles).set({ draftVersionId: v2.id }).where(eq(publicProfiles.id, publicProfileId));
      }
    }
  }
}
