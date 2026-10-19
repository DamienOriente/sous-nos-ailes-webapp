import { and, asc, eq, inArray } from "drizzle-orm";
import { eventMembers, eventMilestones, eventProfessionals, events, inquiries, professionalRecommendations, professionalReviews, professionals } from "@/db/schema";
import { recordAcceptedQuoteInBudget } from "@/modules/events/application/payment-service";
import { refreshRating } from "@/modules/professionals/application/review-service";
import { sequentialLinks } from "@/modules/events/domain/live-day";
import type { SeedContext } from "./context";

/**
 * Demo for verified reviews, "often booked with", recommendations, the live day and the
 * self-updating budget (2026-10-19). Two past events give real confirmed collaborations; Marie
 * and Julien worked on both, so they appear as often booked together. Idempotent.
 */
type PastEvent = { ownerKey: string; name: string; type: "wedding" | "birthday"; date: string; city: string; guests: number; children: number; pros: string[] };

const PAST: PastEvent[] = [
  { ownerKey: "paul", name: "Mariage de Paul et Inès", type: "wedding", date: "2026-06-13", city: "Albi", guests: 110, children: 12, pros: ["marie-delcourt-garde-enfants", "julien-rossi-traiteur", "theo-lambert-dj", "ines-garnier-photographe"] },
  { ownerKey: "louis", name: "Les 40 ans de Louis", type: "birthday", date: "2026-09-05", city: "Lavaur", guests: 60, children: 9, pros: ["marie-delcourt-garde-enfants", "julien-rossi-traiteur", "sofia-martins-animation"] },
];

const PAUL_REVIEWS = [
  { slug: "theo-lambert-dj", rating: 5, title: "Une piste pleine jusqu'à la fin", body: "Théo a respecté à la lettre la playlist préparée ensemble sur la plateforme, et a su lire la salle quand les grands-parents sont partis. Le micro sans fil pour les discours a évité tout flottement." },
  { slug: "ines-garnier-photographe", rating: 4, title: "De belles photos de groupe", body: "La liste des photos de groupe préparée à partir des invités a fait gagner beaucoup de temps. Livraison de la galerie en cinq semaines, un peu plus que prévu mais prévenu à l'avance." },
];

const RECOMMENDATIONS: [string, string, string][] = [
  ["marie-delcourt-garde-enfants", "sofia-martins-animation", "Nous travaillons ensemble sur les mariages : Sofia anime, nous gardons."],
  ["marie-delcourt-garde-enfants", "julien-rossi-traiteur", "Ses menus enfants sont pensés pour nos horaires de repas."],
  ["camille-ferrand-wedding-planner", "domaine-de-la-brugue", "Un lieu que je connais par cœur."],
  ["camille-ferrand-wedding-planner", "julien-rossi-traiteur", "Fiable sur les grands mariages."],
  ["camille-ferrand-wedding-planner", "ines-garnier-photographe", "Discrète et très bien organisée."],
  ["julien-rossi-traiteur", "douceurs-albigeoises", "Pour les pièces montées."],
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const slugs = [...new Set([...PAST.flatMap((e) => e.pros), ...PAUL_REVIEWS.map((r) => r.slug), ...RECOMMENDATIONS.flat().filter((x) => !x.includes(" "))])];
  const pros = await db.select({ id: professionals.id, slug: professionals.slug, categoryId: professionals.primaryCategoryId }).from(professionals).where(inArray(professionals.slug, slugs));
  const bySlug = new Map(pros.map((p) => [p.slug, p]));

  // Past events with confirmed providers (proof for reviews and co-bookings).
  const pastIds: Record<string, string> = {};
  for (const e of PAST) {
    const owner = ctx.users[e.ownerKey];
    if (!owner) continue;
    const [existing] = await db.select({ id: events.id }).from(events).where(and(eq(events.ownerUserId, owner), eq(events.name, e.name))).limit(1);
    const values = { type: e.type, eventDate: e.date, city: e.city, expectedGuests: e.guests, expectedChildren: e.children, status: "completed" as const, isDemo: true, coverPhotoId: null };
    let id = existing?.id;
    if (id) await db.update(events).set(values).where(eq(events.id, id));
    else id = (await db.insert(events).values({ ownerUserId: owner, name: e.name, ...values }).returning({ id: events.id }))[0]!.id;
    pastIds[e.name] = id;
    await db.insert(eventMembers).values({ eventId: id, userId: owner, role: "owner", status: "active", joinedAt: new Date(`${e.date}T00:00:00Z`) }).onConflictDoNothing();
    for (const slug of e.pros) {
      const p = bySlug.get(slug);
      if (!p) continue;
      const [slot] = await db.select({ id: eventProfessionals.id }).from(eventProfessionals).where(and(eq(eventProfessionals.eventId, id), eq(eventProfessionals.professionalId, p.id))).limit(1);
      if (slot) await db.update(eventProfessionals).set({ status: "confirmed" }).where(eq(eventProfessionals.id, slot.id));
      else await db.insert(eventProfessionals).values({ eventId: id, professionalId: p.id, categoryId: p.categoryId, status: "confirmed" });
    }
  }

  // Paul's verified reviews from his wedding.
  const paul = ctx.users.paul;
  const wedding = pastIds["Mariage de Paul et Inès"];
  if (paul && wedding) {
    for (const r of PAUL_REVIEWS) {
      const p = bySlug.get(r.slug);
      if (!p) continue;
      await db.delete(professionalReviews).where(and(eq(professionalReviews.professionalId, p.id), eq(professionalReviews.authorUserId, paul), eq(professionalReviews.eventId, wedding)));
      await db.insert(professionalReviews).values({ professionalId: p.id, authorUserId: paul, eventId: wedding, rating: r.rating, title: r.title, body: r.body, status: "published", verifiedVia: "event", createdAt: new Date("2026-06-20T10:00:00Z") });
      await refreshRating(p.id, db);
    }
  }

  // Recommendations between professionals.
  for (const [from, to, note] of RECOMMENDATIONS) {
    const a = bySlug.get(from);
    const b = bySlug.get(to);
    if (!a || !b) continue;
    await db.insert(professionalRecommendations).values({ professionalId: a.id, recommendedProfessionalId: b.id, note }).onConflictDoUpdate({ target: [professionalRecommendations.professionalId, professionalRecommendations.recommendedProfessionalId], set: { note } });
  }

  // Louis and Lisa's wedding: steps chained for the live day, Julien's quote accepted (budget + schedule).
  const weddingId = ctx.events.louisLisa;
  if (weddingId) {
    const steps = await db.select({ id: eventMilestones.id, startsAt: eventMilestones.startsAt, endsAt: eventMilestones.endsAt }).from(eventMilestones).where(eq(eventMilestones.eventId, weddingId)).orderBy(asc(eventMilestones.startsAt));
    const links = new Map(sequentialLinks(steps));
    for (const s of steps) {
      await db.update(eventMilestones).set({ dependsOnMilestoneId: links.get(s.id) ?? null, delayMinutes: 0, delayReason: null, liveStatus: "planned", startedAt: null, completedAt: null }).where(eq(eventMilestones.id, s.id));
    }
    const julien = bySlug.get("julien-rossi-traiteur");
    if (julien) {
      const [inq] = await db.select({ id: inquiries.id }).from(inquiries).where(and(eq(inquiries.eventId, weddingId), eq(inquiries.professionalId, julien.id))).limit(1);
      if (inq) {
        await db.update(inquiries).set({ status: "accepted" }).where(eq(inquiries.id, inq.id));
        await recordAcceptedQuoteInBudget(weddingId, inq.id, db);
      }
    }
  }
}
