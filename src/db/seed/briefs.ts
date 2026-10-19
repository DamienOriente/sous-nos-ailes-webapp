import { and, eq, inArray } from "drizzle-orm";
import { events, inquiries, inquiryEvents, inquiryQuotes, professionalFavorites, professionalHolds, professionals, users } from "@/db/schema";
import { buildBrief } from "@/modules/events/domain/brief";
import type { StructuredQuote } from "@/modules/inquiries/domain/quote";
import type { SeedContext } from "./context";

/**
 * Demo for the shared brief, the quote comparator and the 48-hour options: Louis and Lisa's
 * wedding has a complete brief, sent to two caterers and two DJs who answered with quotes in the
 * common format; Louis holds a videographer's date; another organiser holds a musician's date.
 * Idempotent: inquiries are keyed by (event, professional), holds by (professional, date, requester).
 */
type DemoQuote = { slug: string; versions: StructuredQuote[] };

const DAY = 86_400_000;
const FAVORITE_SLUGS = ["fleurs-sauvages-atelier", "douceurs-albigeoises"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

const QUOTES: DemoQuote[] = [
  {
    slug: "julien-rossi-traiteur",
    versions: [
      {
        totalCents: 1_380_000,
        lineItems: [
          { label: "Menu mariage trois plats", quantity: 120, unitCents: 8_500 },
          { label: "Menu enfant", quantity: 14, unitCents: 2_000 },
          { label: "Service et maîtres d'hôtel", quantity: 1, unitCents: 300_000 },
        ],
        inclusions: ["Vaisselle et verrerie", "Service à table", "Nappage", "Vin d'honneur"],
        exclusions: ["Boissons du dîner"],
        depositCents: 414_000,
        balanceDueDays: 15,
        cancellationPolicy: "moderate",
        cancellationTerms: null,
        validUntil: iso(new Date(Date.now() + 30 * DAY)),
        note: "Dégustation offerte pour deux personnes, menu adaptable aux régimes déclarés par les invités.",
      },
    ],
  },
  {
    slug: "la-table-de-garonne",
    versions: [
      {
        totalCents: 1_290_000,
        lineItems: [],
        inclusions: ["Vaisselle et verrerie", "Service à table", "Boissons du dîner"],
        exclusions: ["Vin d'honneur", "Nappage"],
        depositCents: 645_000,
        balanceDueDays: 30,
        cancellationPolicy: "strict",
        cancellationTerms: null,
        validUntil: iso(new Date(Date.now() + 10 * DAY)),
        note: "Formule tout compris hors vin d'honneur, en buffet ou à l'assiette.",
      },
      {
        totalCents: 1_240_000,
        lineItems: [],
        inclusions: ["Vaisselle et verrerie", "Service à table", "Boissons du dîner"],
        exclusions: ["Vin d'honneur", "Nappage"],
        depositCents: 620_000,
        balanceDueDays: 30,
        cancellationPolicy: "strict",
        cancellationTerms: null,
        validUntil: iso(new Date(Date.now() + 20 * DAY)),
        note: "Version ajustée après échange : menu enfant offert.",
      },
    ],
  },
  {
    slug: "theo-lambert-dj",
    versions: [
      {
        totalCents: 145_000,
        lineItems: [
          { label: "Soirée DJ jusqu'à 3 h", quantity: 1, unitCents: 120_000 },
          { label: "Animation cérémonie laïque", quantity: 1, unitCents: 25_000 },
        ],
        inclusions: ["Sonorisation", "Éclairage de piste", "Micro sans fil"],
        exclusions: ["Heures après 3 h"],
        depositCents: 43_500,
        balanceDueDays: 0,
        cancellationPolicy: "flexible",
        cancellationTerms: null,
        validUntil: iso(new Date(Date.now() + 45 * DAY)),
        note: "Rendez-vous de préparation de la playlist inclus.",
      },
    ],
  },
  {
    slug: "dj-nova-montpellier",
    versions: [
      {
        totalCents: 118_000,
        lineItems: [],
        inclusions: ["Sonorisation", "Micro sans fil"],
        exclusions: ["Éclairage de piste", "Frais de déplacement"],
        depositCents: 59_000,
        balanceDueDays: 7,
        cancellationPolicy: "custom",
        cancellationTerms: "Acompte conservé quelle que soit la date d'annulation ; le solde n'est jamais dû en cas d'annulation.",
        validUntil: iso(new Date(Date.now() - 3 * DAY)),
        note: "Tarif week-end, jusqu'à 2 h du matin.",
      },
    ],
  },
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const eventId = ctx.events.louisLisa;
  const louis = ctx.users.louis;
  const paul = ctx.users.paul;
  if (!eventId || !louis) throw new Error("demo wedding or Louis missing");

  await db
    .update(events)
    .set({
      style: "Champêtre chic, couleurs sauge et ivoire, dîner sous les platanes",
      preferences: "Cérémonie laïque à 15 h 30 dans le jardin, vin d'honneur puis dîner assis. Espace enfants séparé jusqu'à 23 h. Le domaine impose une fin de musique amplifiée à 3 h.",
      briefShareBudget: true,
      briefUpdatedAt: new Date(ctx.now.getTime() - 20 * DAY),
    })
    .where(eq(events.id, eventId));
  const [e] = await db.select().from(events).where(eq(events.id, eventId));
  const brief = buildBrief(e!);
  const [me] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, louis));

  const pros = await db.select({ id: professionals.id, slug: professionals.slug }).from(professionals).where(inArray(professionals.slug, QUOTES.map((q) => q.slug)));
  const proBySlug = new Map(pros.map((p) => [p.slug, p.id]));
  for (const q of QUOTES) {
    const professionalId = proBySlug.get(q.slug);
    if (!professionalId) continue;
    const values = {
      professionalId,
      requesterUserId: louis,
      eventId,
      kind: "quote" as const,
      status: "quoted" as const,
      requesterName: me?.name ?? "Louis Marchand",
      requesterEmail: me?.email ?? "louis@sousnosailes.test",
      eventTypeLabel: brief.eventTypeLabel,
      eventDate: brief.date,
      eventCity: brief.city,
      guestsCount: brief.guests,
      childrenCount: brief.children,
      message: "Bonjour, voici le brief de notre mariage. Pourriez-vous nous faire une proposition ?",
      brief,
      quoteCents: q.versions.at(-1)!.totalCents,
      quoteNote: q.versions.at(-1)!.note,
      isDemo: true,
    };
    const [existing] = await db.select({ id: inquiries.id }).from(inquiries).where(and(eq(inquiries.eventId, eventId), eq(inquiries.professionalId, professionalId))).limit(1);
    let inquiryId = existing?.id;
    if (inquiryId) {
      await db.update(inquiries).set(values).where(eq(inquiries.id, inquiryId));
    } else {
      const [row] = await db.insert(inquiries).values({ ...values, createdAt: new Date(ctx.now.getTime() - 18 * DAY) }).returning({ id: inquiries.id });
      inquiryId = row!.id;
      await db.insert(inquiryEvents).values([
        { inquiryId, actorUserId: louis, fromStatus: null, toStatus: "new", note: "Brief de l'évènement envoyé depuis l'espace organisateur." },
        { inquiryId, actorUserId: null, fromStatus: "new", toStatus: "quoted", note: "Devis envoyé." },
      ]);
    }
    await db.delete(inquiryQuotes).where(eq(inquiryQuotes.inquiryId, inquiryId));
    await db.insert(inquiryQuotes).values(q.versions.map((v, i) => ({ inquiryId: inquiryId!, version: i + 1, ...v, createdAt: new Date(ctx.now.getTime() - (15 - i * 5) * DAY) })));
  }

  // Options: Louis on a videographer for the wedding date, Paul on the string quartet the same day.
  const holdPros = await db.select({ id: professionals.id, slug: professionals.slug }).from(professionals).where(inArray(professionals.slug, ["studio-lumiere-bordeaux", "quatuor-ondes"]));
  const holdPlan = [
    { slug: "studio-lumiere-bordeaux", requester: louis, eventId, hours: 30 },
    { slug: "quatuor-ondes", requester: paul, eventId: null, hours: 40 },
  ];
  for (const h of holdPlan) {
    const professionalId = holdPros.find((p) => p.slug === h.slug)?.id;
    if (!professionalId || !h.requester || !brief.date) continue;
    await db.delete(professionalHolds).where(and(eq(professionalHolds.professionalId, professionalId), eq(professionalHolds.holdDate, brief.date), eq(professionalHolds.requesterUserId, h.requester)));
    await db.insert(professionalHolds).values({ professionalId, requesterUserId: h.requester, eventId: h.eventId, holdDate: brief.date, status: "active", expiresAt: new Date(Date.now() + h.hours * 3600 * 1000), isDemo: true });
  }

  // Favourites, so the brief page shows free, optioned and busy providers.
  const favs = await db.select({ id: professionals.id }).from(professionals).where(inArray(professionals.slug, ["studio-lumiere-bordeaux", "quatuor-ondes", ...FAVORITE_SLUGS]));
  if (favs.length) await db.insert(professionalFavorites).values(favs.map((f) => ({ userId: louis, professionalId: f.id }))).onConflictDoNothing();
}
