import { and, desc, eq, inArray } from "drizzle-orm";
import { appeals, editorialPages, moderationCases, moderationDecisions, professionals, reports, users } from "@/db/schema";
import { DRAFT_NOTICE, LEGAL_DEFAULTS, LEGAL_SLUGS } from "@/modules/legal/domain/defaults";
import type { SeedContext } from "./context";

/**
 * Moderation demo data + editorial pages. Runs last: it reads the listings'
 * statuses left by the professionals seed. Idempotent (lookups before inserts).
 */
const SPONSORED_PAGE = `> ${DRAFT_NOTICE}

## Critères de classement
Les résultats de l'annuaire sont ordonnés par pertinence : correspondance avec le métier recherché, proximité géographique, disponibilité déclarée, compatibilité avec le type d'évènement, complétude de la fiche, niveau de vérification et avis publiés. Aucun critère financier n'entre dans ce score.

## Résultats sponsorisés
Un professionnel disposant de l'offre Premium peut bénéficier d'un emplacement sponsorisé sur une catégorie et/ou un département, pour une durée définie. Ces résultats apparaissent dans une zone distincte en tête de liste et portent toujours l'étiquette **Sponsorisé**.

## Limites
- Nombre de résultats sponsorisés par recherche limité (paramètre public, 2 par défaut).
- Seules les fiches publiées, donc passées par la modération, peuvent être sponsorisées : un emplacement ne contourne jamais une vérification ni une suspension.
- Aucune position n'est garantie : l'affichage dépend des filtres de recherche et d'une rotation entre professionnels éligibles.
- Le sponsoring n'influence ni les avis, ni le niveau de vérification, ni le score des résultats organiques.

## Mentions de vérification
Les badges décrivent précisément ce qui a été contrôlé par l'équipe de **{{legal.company_name}}** et ne constituent ni une certification officielle, ni une garantie sur la prestation. [À COMPLÉTER : référence à la procédure interne de vérification.]

## Réclamations
Toute question sur un classement peut être adressée à {{legal.contact_email}}. [À COMPLÉTER : délai de réponse et voie de recours.]`;

const FAQ_PAGE = `## Organisateurs
### L'inscription est-elle gratuite ?
Oui. L'offre gratuite permet de créer vos évènements, chercher des professionnels, gérer tâches, contacts et invitations essentielles. L'offre Plus ajoute le plan de table, les invitations personnalisées, le budget avancé et les exports.

### Comment sont choisis les professionnels affichés ?
Par pertinence (métier, distance, disponibilité, complétude, vérification, avis). Les emplacements sponsorisés sont limités et toujours étiquetés — voir [Classements sponsorisés](/classements-sponsorises).

### Que signifient les badges de vérification ?
Chaque badge indique exactement ce qui a été contrôlé (par exemple « Assurance vérifiée » = attestation en cours de validité examinée à la date indiquée). Aucune certification officielle n'est inventée.

## Professionnels
### Combien de temps dure la validation d'une fiche ?
Une fiche soumise est relue par l'équipe de modération ; vous êtes prévenu de chaque décision avec son motif et pouvez corriger puis soumettre à nouveau.

### Comment résilier l'offre Premium ?
Depuis votre fiche → Abonnement → « Résilier à l'échéance », en deux clics. L'offre reste active jusqu'à la fin de la période payée.

## Données et enfants
### Qui voit les informations des enfants ?
Uniquement l'organisateur qui les a saisies et l'équipe de garde affectée, pour les enfants qui lui sont confiés. Les données de santé sont chiffrées et chaque accès est journalisé. L'équipe de la plateforme n'y accède pas, sauf procédure exceptionnelle légale, tracée et notifiée.`;

export async function seed(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const moderator = ctx.users.moderator;
  const admin = ctx.users.admin;
  if (!moderator || !admin) return;

  // ── Moderation cases for listings awaiting review ────────────────────────
  const pending = await db.select({ id: professionals.id, displayName: professionals.displayName, status: professionals.status, ownerUserId: professionals.ownerUserId }).from(professionals).where(and(eq(professionals.isDemo, true), inArray(professionals.status, ["pending_review", "changes_requested"])));
  for (const p of pending) {
    const [existing] = await db.select({ id: moderationCases.id }).from(moderationCases).where(and(eq(moderationCases.resourceType, "professional"), eq(moderationCases.resourceId, p.id), inArray(moderationCases.status, ["open", "in_review"]))).limit(1);
    if (existing) continue;
    const [c] = await db
      .insert(moderationCases)
      .values({ kind: "profile_review", status: p.status === "changes_requested" ? "in_review" : "open", resourceType: "professional", resourceId: p.id, professionalId: p.id, openedByUserId: p.ownerUserId, assignedToUserId: p.status === "changes_requested" ? moderator : null, summary: `Fiche « ${p.displayName} » soumise pour validation (démo).`, createdAt: new Date(now.getTime() - 3 * 86_400_000) })
      .returning({ id: moderationCases.id });
    if (c && p.status === "changes_requested") {
      await db.insert(moderationDecisions).values({ caseId: c.id, decision: "request_changes", reason: "Merci de préciser vos tarifs (fourchette et unité) et d'ajouter au moins une photo de vos prestations avant publication.", decidedByUserId: moderator, createdAt: new Date(now.getTime() - 2 * 86_400_000) });
    }
  }

  // ── Historised decisions on published demo listings ──────────────────────
  const published = await db.select({ id: professionals.id, displayName: professionals.displayName, ownerUserId: professionals.ownerUserId }).from(professionals).where(and(eq(professionals.isDemo, true), eq(professionals.status, "published"))).orderBy(desc(professionals.createdAt)).limit(4);
  for (const [i, p] of published.entries()) {
    const [existing] = await db.select({ id: moderationCases.id }).from(moderationCases).where(and(eq(moderationCases.kind, "profile_review"), eq(moderationCases.resourceId, p.id), eq(moderationCases.status, "resolved"))).limit(1);
    if (existing) continue;
    const at = new Date(now.getTime() - (20 + i * 7) * 86_400_000);
    const [c] = await db.insert(moderationCases).values({ kind: "profile_review", status: "resolved", resourceType: "professional", resourceId: p.id, professionalId: p.id, openedByUserId: p.ownerUserId, assignedToUserId: moderator, summary: `Fiche « ${p.displayName} » soumise pour validation (démo).`, resolvedAt: at, createdAt: new Date(at.getTime() - 2 * 86_400_000) }).returning({ id: moderationCases.id });
    if (c) await db.insert(moderationDecisions).values({ caseId: c.id, decision: "approve", reason: "Informations professionnelles cohérentes avec l'avis de situation SIRENE transmis, description conforme à la charte, photos adaptées à un public familial.", decidedByUserId: moderator, createdAt: at });
  }

  // ── Two reports + one appeal ─────────────────────────────────────────────
  const theo = ctx.professionals.theo;
  const julien = ctx.professionals.julien;
  const louis = ctx.users.louis;
  const paul = ctx.users.paul;
  const [existingReports] = await db.select({ id: reports.id }).from(reports).where(eq(reports.details, "[démo] Les horaires annoncés sur la fiche ne correspondent pas à ceux indiqués au téléphone.")).limit(1);
  if (!existingReports && julien && louis) {
    const [c] = await db.insert(moderationCases).values({ kind: "report", status: "open", resourceType: "professional", resourceId: julien, professionalId: julien, openedByUserId: louis, summary: "Signalement (Autre) sur professional." }).returning({ id: moderationCases.id });
    await db.insert(reports).values({ reporterUserId: louis, resourceType: "professional", resourceId: julien, reason: "other", details: "[démo] Les horaires annoncés sur la fiche ne correspondent pas à ceux indiqués au téléphone.", caseId: c?.id ?? null });
  }
  const [existingReport2] = await db.select({ id: reports.id }).from(reports).where(eq(reports.reporterEmail, "visiteur.demo@sousnosailes.test")).limit(1);
  if (!existingReport2 && theo) {
    const [c] = await db.insert(moderationCases).values({ kind: "report", status: "open", resourceType: "professional", resourceId: theo, professionalId: theo, summary: "Signalement (Spam) sur professional." }).returning({ id: moderationCases.id });
    await db.insert(reports).values({ reporterEmail: "visiteur.demo@sousnosailes.test", resourceType: "professional", resourceId: theo, reason: "spam", details: "[démo] La description contient des liens répétés vers un site tiers.", caseId: c?.id ?? null });
  }
  if (theo && ctx.users.theo && paul) {
    const [existingAppeal] = await db.select({ id: appeals.id }).from(appeals).where(eq(appeals.appellantUserId, ctx.users.theo)).limit(1);
    if (!existingAppeal) {
      const at = new Date(now.getTime() - 10 * 86_400_000);
      const [c] = await db.insert(moderationCases).values({ kind: "review_moderation", status: "in_review", resourceType: "review", resourceId: "demo-review-theo", professionalId: theo, openedByUserId: ctx.users.theo, summary: "Avis contesté par le professionnel (démo).", createdAt: at }).returning({ id: moderationCases.id });
      if (c) {
        await db.insert(moderationDecisions).values({ caseId: c.id, decision: "dismiss", reason: "L'avis décrit une prestation réelle et reste factuel ; il est maintenu.", decidedByUserId: moderator, createdAt: new Date(at.getTime() + 86_400_000) });
        await db.insert(appeals).values({ caseId: c.id, appellantUserId: ctx.users.theo, argument: "[démo] L'auteur de cet avis n'a jamais été client : aucune prestation n'a eu lieu à la date indiquée. Je demande un réexamen avec les éléments de mon agenda.", status: "open", createdAt: new Date(at.getTime() + 2 * 86_400_000) });
      }
    }
  }

  // ── Editorial pages: structured drafts, published with the draft notice ──
  const pages: Array<{ slug: string; title: string; body: string }> = [
    ...LEGAL_SLUGS.map((slug) => ({ slug, title: LEGAL_DEFAULTS[slug].title, body: LEGAL_DEFAULTS[slug].body })),
    { slug: "signalement", title: "Signaler un contenu", body: LEGAL_DEFAULTS["signalement-procedure"].body },
    { slug: "classements-sponsorises", title: "Classements et résultats sponsorisés", body: SPONSORED_PAGE },
    { slug: "faq", title: "Questions fréquentes", body: FAQ_PAGE },
  ];
  for (const p of pages) {
    const body = p.body.includes(DRAFT_NOTICE) ? p.body : `> ${DRAFT_NOTICE}\n\n${p.body}`;
    const [existing] = await db.select({ slug: editorialPages.slug }).from(editorialPages).where(eq(editorialPages.slug, p.slug)).limit(1);
    if (existing) continue; // never overwrite staff edits
    await db.insert(editorialPages).values({ slug: p.slug, title: p.title, body, isPublished: "published", updatedByUserId: admin });
  }

  // Keep privileged demo accounts flagged (the admin pages show the 2FA warning banner in demo mode).
  await db.update(users).set({ isDemo: true }).where(inArray(users.id, [moderator, admin]));
}
