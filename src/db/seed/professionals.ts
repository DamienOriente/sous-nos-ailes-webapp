import { and, eq, inArray } from "drizzle-orm";
import {
  featuredPlacements,
  inquiries,
  inquiryEvents,
  professionalAvailability,
  professionalCategories,
  professionalCategoryAssignments,
  professionalReviews,
  professionalServices,
  professionalToolActivations,
  professionalVerifications,
  professionals,
  toolDefinitions,
  userProfiles,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveLocation } from "@/modules/professionals/domain/geo";
import { refreshRating } from "@/modules/professionals/application/review-service";
import { recomputeDerived } from "@/modules/professionals/application/professional-service";
import type { VerificationKind } from "@/modules/professionals/domain/verification";
import { DEMO_PASSWORD, type SeedContext } from "./context";
import { PROS, REVIEWERS, REVIEWS, type Pro } from "./professionals-data";

/**
 * Demo professionals. Idempotent: listings are upserted by slug, child rows
 * (services, availability, verifications) are replaced, inquiries/reviews/
 * placements are inserted once. Every row is flagged isDemo where possible.
 * The content itself (listings, reviewers, reviews) lives in professionals-data.ts.
 */
const VERIFICATION_PLAN: Array<{ level: number; kind: VerificationKind; statement: string; validMonths?: number }> = [
  { level: 1, kind: "identity_declared", statement: "Identité et coordonnées renseignées par le professionnel lors de l'inscription." },
  { level: 2, kind: "business_registration_checked", statement: "SIREN rapproché d'un avis de situation SIRENE daté de moins de trois mois." },
  { level: 2, kind: "administrative_check_done", statement: "Cohérence identité / immatriculation / coordonnées vérifiée par l'équipe." },
  { level: 3, kind: "documents_reviewed", statement: "Justificatifs transmis lus par un modérateur ; aucune garantie de qualité de prestation." },
  { level: 4, kind: "insurance_verified", statement: "Attestation RC professionnelle en cours de validité examinée.", validMonths: 10 },
  { level: 5, kind: "qualification_verified", statement: "Diplômes et attestations de formation (CAP AEPE, PSC1) examinés." },
];

/** Creates (once) a demo account through better-auth so it can really sign in with the shared password. */
async function ensureDemoAccount(ctx: SeedContext, spec: { name: string; email: string }, intent: "professional" | "organizer"): Promise<string> {
  const { db } = ctx;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, spec.email)).limit(1);
  let id = existing?.id;
  if (!id) {
    const res = await auth.api.signUpEmail({ body: { email: spec.email, password: DEMO_PASSWORD, name: spec.name } });
    id = res.user.id;
  }
  await db.update(users).set({ emailVerified: true, isDemo: true }).where(eq(users.id, id));
  const [first, ...rest] = spec.name.split(" ");
  await db
    .insert(userProfiles)
    .values({ userId: id, firstName: first ?? "", lastName: rest.join(" "), primaryIntent: intent, onboardingCompletedAt: ctx.now })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { primaryIntent: intent, onboardingCompletedAt: ctx.now } });
  return id;
}

async function ensureUser(ctx: SeedContext, pro: Pro): Promise<string> {
  if ("key" in pro.user) {
    const id = ctx.users[pro.user.key];
    if (!id) throw new Error(`demo user ${pro.user.key} missing from context`);
    return id;
  }
  const id = await ensureDemoAccount(ctx, pro.user, "professional");
  ctx.users[`pro:${pro.key}`] = id;
  return id;
}

async function upsertListing(ctx: SeedContext, pro: Pro, ownerUserId: string): Promise<string> {
  const { db } = ctx;
  const categoryId = ctx.categories[pro.category];
  if (!categoryId) throw new Error(`category ${pro.category} missing`);
  const loc = resolveLocation(pro.city, pro.postalCode);
  const moderator = ctx.users.moderator ?? null;
  const values = {
    ownerUserId,
    slug: pro.slug,
    displayName: pro.displayName,
    tagline: pro.tagline,
    description: pro.description.join("\n\n"),
    primaryCategoryId: categoryId,
    status: pro.status,
    statusReason: pro.statusReason ?? null,
    city: pro.city,
    postalCode: pro.postalCode,
    department: loc.department?.code ?? null,
    region: loc.region,
    latitude: loc.latitude,
    longitude: loc.longitude,
    interventionRadiusKm: pro.radiusKm ?? 50,
    priceFromCents: pro.priceFromCents ?? null,
    priceToCents: pro.priceToCents ?? null,
    priceUnit: pro.priceUnit ?? null,
    languages: pro.languages ?? ["fr"],
    eventTypes: pro.eventTypes ?? [],
    yearsExperience: pro.yearsExperience ?? null,
    tradeDetails: pro.tradeDetails,
    publicEmail: pro.publicEmail ?? null,
    publicPhone: pro.publicPhone ?? null,
    website: pro.website ?? null,
    socialLinks: pro.socialLinks ?? {},
    isDemo: true,
    acceptsChildrenServices: pro.acceptsChildren ?? false,
    publishedAt: pro.status === "published" ? new Date(ctx.now.getTime() - 90 * 24 * 3600 * 1000) : null,
    deletedAt: null,
  };
  const [row] = await db
    .insert(professionals)
    .values(values)
    .onConflictDoUpdate({ target: professionals.slug, set: values })
    .returning({ id: professionals.id });
  if (!row) throw new Error("upsert failed");
  const id = row.id;

  await db.delete(professionalCategoryAssignments).where(eq(professionalCategoryAssignments.professionalId, id));
  const secondaryIds = (pro.secondary ?? []).map((s) => ctx.categories[s]).filter((x): x is string => Boolean(x));
  if (secondaryIds.length) await db.insert(professionalCategoryAssignments).values(secondaryIds.map((categoryId) => ({ professionalId: id, categoryId })));

  await db.delete(professionalServices).where(eq(professionalServices.professionalId, id));
  if (pro.services.length) {
    await db.insert(professionalServices).values(
      pro.services.map((s, i) => ({
        professionalId: id,
        name: s.name,
        description: s.description ?? null,
        priceCents: s.priceCents ?? null,
        priceUnit: s.priceUnit ?? null,
        durationMinutes: s.durationMinutes ?? null,
        minAge: s.minAge ?? null,
        maxAge: s.maxAge ?? null,
        capacity: s.capacity ?? null,
        sortOrder: i,
      })),
    );
  }

  await db.delete(professionalAvailability).where(eq(professionalAvailability.professionalId, id));
  if (pro.availability?.length) {
    await db.insert(professionalAvailability).values(pro.availability.flatMap((weekday) => [{ professionalId: id, weekday, startMinute: 8 * 60, endMinute: 12 * 60 }, { professionalId: id, weekday, startMinute: 12 * 60, endMinute: 18 * 60 }, { professionalId: id, weekday, startMinute: 18 * 60, endMinute: 24 * 60 }]));
  }

  await db.delete(professionalVerifications).where(eq(professionalVerifications.professionalId, id));
  const rows = VERIFICATION_PLAN.filter((v) => v.level <= pro.verificationLevel).map((v) => ({
    professionalId: id,
    kind: v.kind,
    status: "verified" as const,
    statement: v.statement,
    reviewedByUserId: v.kind === "identity_declared" ? null : moderator,
    reviewedAt: new Date(ctx.now.getTime() - 60 * 24 * 3600 * 1000),
    validUntil: v.validMonths ? new Date(ctx.now.getTime() + v.validMonths * 30 * 24 * 3600 * 1000) : null,
  }));
  // Declared-but-not-verified rows add realism for mid levels.
  if (pro.verificationLevel >= 2 && pro.verificationLevel < 4 && pro.tradeDetails.insuranceDeclared) {
    rows.push({ professionalId: id, kind: "insurance_declared", status: "verified" as const, statement: "Le professionnel déclare détenir une RC professionnelle ; attestation en attente d'examen.", reviewedByUserId: null, reviewedAt: new Date(ctx.now.getTime() - 60 * 24 * 3600 * 1000), validUntil: null });
  }
  if (rows.length) await db.insert(professionalVerifications).values(rows);

  // Default tools of the trade (free ones), idempotent.
  const [cat] = await db.select({ defaultTools: professionalCategories.defaultTools }).from(professionalCategories).where(eq(professionalCategories.id, categoryId)).limit(1);
  const keys = cat?.defaultTools ?? [];
  if (keys.length) {
    const free = await db.select({ key: toolDefinitions.key, requiredFeature: toolDefinitions.requiredFeature }).from(toolDefinitions).where(inArray(toolDefinitions.key, keys));
    for (const t of free.filter((t) => !t.requiredFeature)) {
      await db.insert(professionalToolActivations).values({ professionalId: id, toolKey: t.key, enabled: true }).onConflictDoNothing();
    }
  }
  await recomputeDerived(id, db);
  return id;
}

type DemoInquiry = { proKey: string; requesterKey: string; kind: "contact" | "availability" | "quote"; status: "new" | "viewed" | "quoted" | "accepted" | "confirmed" | "declined"; message: string; quoteCents?: number; childrenCount?: number; guestsCount?: number; daysAgo: number };

const INQUIRIES: DemoInquiry[] = [
  { proKey: "marie", requesterKey: "louis", kind: "quote", status: "confirmed", message: "Bonjour Marie, nous nous marions le 12 juin 2027 au Domaine de la Brugue avec une quinzaine d'enfants de 1 à 10 ans. Pourriez-vous nous faire un devis pour la cérémonie, le cocktail et la soirée ?", quoteCents: 110000, childrenCount: 15, guestsCount: 120, daysAgo: 45 },
  { proKey: "marie", requesterKey: "paul", kind: "availability", status: "viewed", message: "Bonjour, êtes-vous disponible le samedi 20 septembre 2026 pour un baptême à Toulouse avec 8 enfants ?", childrenCount: 8, guestsCount: 40, daysAgo: 2 },
  { proKey: "marie", requesterKey: "lisa", kind: "contact", status: "new", message: "Nous aimerions ajouter un atelier couronnes de fleurs pour les enfants pendant le vin d'honneur. Est-ce possible en complément de la garde ?", childrenCount: 15, daysAgo: 0 },
  { proKey: "julien", requesterKey: "louis", kind: "quote", status: "quoted", message: "Devis pour 120 convives, cocktail + dîner servi, avec 15 menus enfants et 3 invités sans gluten.", quoteCents: 1420000, guestsCount: 120, childrenCount: 15, daysAgo: 30 },
  { proKey: "theo", requesterKey: "louis", kind: "quote", status: "accepted", message: "Soirée dansante jusqu'à 3 h + sonorisation de la cérémonie laïque en extérieur.", quoteCents: 185000, guestsCount: 120, daysAgo: 28 },
  { proKey: "ines", requesterKey: "louis", kind: "contact", status: "confirmed", message: "Nous adorons votre approche naturelle. Reportage journée complète avec second photographe ?", guestsCount: 120, daysAgo: 60 },
  { proKey: "sofia", requesterKey: "paul", kind: "quote", status: "confirmed", message: "Baptême de Chloé le 20 septembre : 8 enfants de 2 à 9 ans, un spectacle de marionnettes serait parfait.", quoteCents: 42000, childrenCount: 8, guestsCount: 40, daysAgo: 20 },
  { proKey: "camille", requesterKey: "paul", kind: "contact", status: "declined", message: "Cherchons une coordination pour un séminaire de 60 personnes en novembre.", guestsCount: 60, daysAgo: 15 },
  { proKey: "petits-nuages", requesterKey: "paul", kind: "availability", status: "new", message: "Disponibilité pour un séminaire d'entreprise à Bordeaux le 14 novembre, 12 enfants attendus.", childrenCount: 12, daysAgo: 1 },
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  for (const pro of PROS) {
    const ownerUserId = await ensureUser(ctx, pro);
    ctx.professionals[pro.key] = await upsertListing(ctx, pro, ownerUserId);
  }

  // Inquiries (optionally linked to the Louis & Lisa wedding when it exists already).
  for (const q of INQUIRIES) {
    const professionalId = ctx.professionals[q.proKey];
    const requesterUserId = ctx.users[q.requesterKey];
    if (!professionalId || !requesterUserId) continue;
    const [requester] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, requesterUserId)).limit(1);
    if (!requester) continue;
    const [existing] = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(and(eq(inquiries.professionalId, professionalId), eq(inquiries.requesterUserId, requesterUserId), eq(inquiries.kind, q.kind), eq(inquiries.message, q.message)))
      .limit(1);
    if (existing) continue;
    const createdAt = new Date(ctx.now.getTime() - q.daysAgo * 24 * 3600 * 1000);
    const eventId = q.requesterKey === "louis" || q.requesterKey === "lisa" ? (ctx.events.louisLisa ?? null) : q.requesterKey === "paul" && q.proKey === "sofia" ? (ctx.events.baptemeChloe ?? null) : null;
    const [row] = await db
      .insert(inquiries)
      .values({
        professionalId,
        requesterUserId,
        eventId,
        kind: q.kind,
        status: q.status,
        requesterName: requester.name,
        requesterEmail: requester.email,
        eventTypeLabel: q.proKey === "sofia" || (q.requesterKey === "paul" && q.kind !== "contact") ? "Baptême" : q.requesterKey === "paul" ? "Séminaire" : "Mariage",
        eventDate: q.requesterKey === "paul" ? "2026-09-20" : "2027-06-12",
        eventCity: q.proKey === "petits-nuages" ? "Bordeaux" : q.requesterKey === "paul" ? "Toulouse" : "Lavaur",
        guestsCount: q.guestsCount ?? null,
        childrenCount: q.childrenCount ?? null,
        message: q.message,
        quoteCents: q.quoteCents ?? null,
        quoteNote: q.quoteCents ? "Devis indicatif de démonstration." : null,
        isDemo: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: inquiries.id });
    if (!row) continue;
    const steps: Array<{ from: typeof q.status | null; to: typeof q.status | "new" | "viewed" | "quoted" | "accepted"; note: string | null }> = [{ from: null, to: "new", note: "Demande reçue depuis la page publique." }];
    if (q.status !== "new") steps.push({ from: "new", to: "viewed", note: null });
    if (["quoted", "accepted", "confirmed"].includes(q.status)) steps.push({ from: "viewed", to: "quoted", note: q.quoteCents ? `Devis : ${(q.quoteCents / 100).toFixed(2)} €` : null });
    if (["accepted", "confirmed"].includes(q.status)) steps.push({ from: "quoted", to: "accepted", note: "Le demandeur a accepté le devis." });
    if (q.status === "confirmed") steps.push({ from: "accepted", to: "confirmed", note: "Prestation confirmée." });
    if (q.status === "declined") steps.push({ from: "viewed", to: "declined", note: "Indisponible à cette date." });
    const proOwner = (await db.select({ ownerUserId: professionals.ownerUserId }).from(professionals).where(eq(professionals.id, professionalId)).limit(1))[0]?.ownerUserId ?? null;
    await db.insert(inquiryEvents).values(steps.map((s, i) => ({ inquiryId: row.id, actorUserId: i === 0 ? requesterUserId : proOwner, fromStatus: s.from, toStatus: s.to, note: s.note, createdAt: new Date(createdAt.getTime() + i * 3600 * 1000) })));
  }

  // Reviews: each one hangs on a confirmed inquiry from a demo organiser (reviewers are demo accounts too).
  for (const r of REVIEWERS) ctx.users[r.key] = await ensureDemoAccount(ctx, r, "organizer");
  for (const r of REVIEWS) {
    const professionalId = ctx.professionals[r.proKey];
    const authorUserId = ctx.users[r.authorKey];
    if (!professionalId || !authorUserId) continue;
    const [author] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, authorUserId)).limit(1);
    if (!author) continue;
    const createdAt = new Date(ctx.now.getTime() - r.daysAgo * 24 * 3600 * 1000);
    const inquiryCreatedAt = new Date(createdAt.getTime() - 40 * 24 * 3600 * 1000);
    const eventId = r.authorKey === "louis" || r.authorKey === "lisa" ? (ctx.events.louisLisa ?? null) : r.authorKey === "paul" && r.proKey === "sofia" ? (ctx.events.baptemeChloe ?? null) : null;
    let [inquiry] = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(and(eq(inquiries.professionalId, professionalId), eq(inquiries.requesterUserId, authorUserId), eq(inquiries.message, r.event.message)))
      .limit(1);
    if (!inquiry) {
      const [row] = await db
        .insert(inquiries)
        .values({
          professionalId,
          requesterUserId: authorUserId,
          eventId,
          kind: "quote",
          status: "confirmed",
          requesterName: author.name,
          requesterEmail: author.email,
          eventTypeLabel: r.event.label,
          eventDate: r.event.date,
          eventCity: r.event.city,
          guestsCount: r.event.guests ?? null,
          childrenCount: r.event.children ?? null,
          message: r.event.message,
          quoteCents: r.event.quoteCents ?? null,
          quoteNote: r.event.quoteCents ? "Devis indicatif de démonstration." : null,
          isDemo: true,
          createdAt: inquiryCreatedAt,
          updatedAt: createdAt,
        })
        .returning({ id: inquiries.id });
      if (!row) continue;
      inquiry = row;
      const proOwner = (await db.select({ ownerUserId: professionals.ownerUserId }).from(professionals).where(eq(professionals.id, professionalId)).limit(1))[0]?.ownerUserId ?? null;
      const steps = [
        { from: null, to: "new", note: "Demande reçue depuis la page publique.", hours: 0, actor: authorUserId },
        { from: "new", to: "viewed", note: null, hours: 3, actor: proOwner },
        { from: "viewed", to: "quoted", note: r.event.quoteCents ? `Devis : ${(r.event.quoteCents / 100).toFixed(2)} €` : "Devis envoyé.", hours: 20, actor: proOwner },
        { from: "quoted", to: "accepted", note: "Le demandeur a accepté le devis.", hours: 72, actor: authorUserId },
        { from: "accepted", to: "confirmed", note: "Prestation confirmée.", hours: 80, actor: proOwner },
      ] as const;
      await db.insert(inquiryEvents).values(steps.map((st) => ({ inquiryId: row.id, actorUserId: st.actor, fromStatus: st.from, toStatus: st.to, note: st.note, createdAt: new Date(inquiryCreatedAt.getTime() + st.hours * 3600 * 1000) })));
    }
    const [existing] = await db.select({ id: professionalReviews.id }).from(professionalReviews).where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.authorUserId, authorUserId))).limit(1);
    if (!existing) {
      await db.insert(professionalReviews).values({
        professionalId,
        authorUserId,
        eventId,
        inquiryId: inquiry.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: "published",
        replyBody: r.reply ?? null,
        repliedAt: r.reply ? new Date(createdAt.getTime() + 2 * 24 * 3600 * 1000) : null,
        createdAt,
        updatedAt: createdAt,
      });
    } else {
      await db.update(professionalReviews).set({ rating: r.rating, title: r.title, body: r.body, status: "published", replyBody: r.reply ?? null, inquiryId: inquiry.id, createdAt }).where(eq(professionalReviews.id, existing.id));
    }
  }
  for (const professionalId of Object.values(ctx.professionals)) await refreshRating(professionalId, db);

  // Two active sponsored placements (childcare in Haute-Garonne, animation in Gironde).
  const placements = [
    { proKey: "marie", categorySlug: "garde-enfants-evenementielle", department: "31" },
    { proKey: "sofia", categorySlug: "animation-enfants", department: "33" },
  ];
  for (const p of placements) {
    const professionalId = ctx.professionals[p.proKey];
    if (!professionalId) continue;
    const [existing] = await db
      .select({ id: featuredPlacements.id })
      .from(featuredPlacements)
      .where(and(eq(featuredPlacements.professionalId, professionalId), eq(featuredPlacements.categorySlug, p.categorySlug), eq(featuredPlacements.department, p.department)))
      .limit(1);
    if (existing) {
      await db.update(featuredPlacements).set({ isActive: true, startsAt: new Date(ctx.now.getTime() - 7 * 24 * 3600 * 1000), endsAt: new Date(ctx.now.getTime() + 60 * 24 * 3600 * 1000) }).where(eq(featuredPlacements.id, existing.id));
      continue;
    }
    await db.insert(featuredPlacements).values({ professionalId, categorySlug: p.categorySlug, department: p.department, startsAt: new Date(ctx.now.getTime() - 7 * 24 * 3600 * 1000), endsAt: new Date(ctx.now.getTime() + 60 * 24 * 3600 * 1000), isActive: true });
  }
}
