/**
 * Verified reviews, live day-of timeline, self-updating budget, professional network and
 * booking retroplanning (2026-10-19).
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { emailOutbox, eventBudgetLines, eventExpenses, eventMilestones, eventPaymentItems, eventProfessionals, events, eventTasks, inquiries, notifications, professionalCategories, professionalReviews, professionals } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getLiveDay, reportDelay, setDependency, setLiveStatus } from "@/modules/events/application/live-day-service";
import { listPaymentItems, markPaymentPaid, recordAcceptedQuoteInBudget, remindUpcomingPayments } from "@/modules/events/application/payment-service";
import { addRetroplanningTasks, getRetroplanning } from "@/modules/events/application/retroplanning-service";
import { addDays } from "@/modules/events/domain/checklist";
import { answerQuote, sendQuote } from "@/modules/inquiries/application/inquiry-service";
import { quoteFormSchema, toStructuredQuote } from "@/modules/inquiries/domain/quote";
import { addRecommendation, getOftenBookedWith, getRecommendedPartners, listMyRecommendations, removeRecommendation } from "@/modules/professionals/application/recommendation-service";
import { createVerifiedReview, listPublishedReviews, listReviewOpportunities } from "@/modules/professionals/application/review-service";
import { addMember, cleanupUsers, createEvent, createUser } from "./_fixtures";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
let ORG: Actor, OTHER: Actor, P1: Actor, P2: Actor, P3: Actor, DJ: Actor;
let traiteur: string, djCat: string;
let p1: string, p2: string, p3: string;
const all = () => [ORG, OTHER, P1, P2, P3, DJ];

async function listing(owner: Actor, name: string, categoryId: string, status: "published" | "draft" = "published") {
  const [row] = await db.insert(professionals).values({ ownerUserId: owner.userId, slug: `itest-${randomUUID().slice(0, 8)}`, displayName: `Itest Net ${name}`, primaryCategoryId: categoryId, status, publishedAt: new Date(), city: "Albi", postalCode: "81000", department: "81", isDemo: true }).returning({ id: professionals.id });
  return row!.id;
}

async function eventOn(owner: Actor, name: string, date: string, pros: { id: string; status?: "confirmed" | "quoted" }[] = []) {
  const id = await createEvent(owner, name);
  await db.update(events).set({ eventDate: date, startsAt: new Date(`${date}T12:00:00Z`) }).where(eq(events.id, id));
  for (const p of pros) await db.insert(eventProfessionals).values({ eventId: id, professionalId: p.id, categoryId: traiteur, status: p.status ?? "confirmed" });
  return id;
}

beforeAll(async () => {
  ORG = await createUser("net-org");
  OTHER = await createUser("net-other");
  P1 = await createUser("net-p1");
  P2 = await createUser("net-p2");
  P3 = await createUser("net-p3");
  DJ = await createUser("net-dj");
  const cats = await db.select({ id: professionalCategories.id, slug: professionalCategories.slug }).from(professionalCategories).where(inArray(professionalCategories.slug, ["traiteur", "dj"]));
  traiteur = cats.find((c) => c.slug === "traiteur")!.id;
  djCat = cats.find((c) => c.slug === "dj")!.id;
  p1 = await listing(P1, "Un", traiteur);
  p2 = await listing(P2, "Deux", traiteur);
  p3 = await listing(P3, "Trois", traiteur, "draft");
});

afterAll(async () => {
  const ids = all().map((a) => a.userId);
  await db.delete(professionalReviews).where(inArray(professionalReviews.authorUserId, ids));
  await cleanupUsers([ORG, OTHER]);
  await db.delete(professionals).where(inArray(professionals.ownerUserId, ids));
  await cleanupUsers(all());
  await db.delete(emailOutbox).where(like(emailOutbox.toEmail, "itest-net-%"));
});

describe("verified reviews", () => {
  it("only an organiser who worked with the professional, after the event, once", async () => {
    const past = await eventOn(ORG, "net past", addDays(today, -10), [{ id: p1 }]);
    await eventOn(ORG, "net future", addDays(today, 30), [{ id: p2 }]);
    const ops = await listReviewOpportunities(ORG);
    expect(ops.map((o) => o.professionalId)).toContain(p1);
    expect(ops.map((o) => o.professionalId)).not.toContain(p2);
    const body = "Une équipe ponctuelle et attentive, le repas est arrivé à l'heure prévue.";
    const { id } = await createVerifiedReview(ORG, { professionalId: p1, eventId: past, inquiryId: null, rating: 5, title: "", body });
    const [r] = await db.select().from(professionalReviews).where(eq(professionalReviews.id, id));
    expect(r).toMatchObject({ status: "pending", verifiedVia: "event", eventId: past });
    await expect(createVerifiedReview(ORG, { professionalId: p1, eventId: past, inquiryId: null, rating: 4, title: "", body })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createVerifiedReview(OTHER, { professionalId: p1, eventId: past, inquiryId: null, rating: 1, title: "", body })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("accepts a booking the professional confirmed, and never shows unverified reviews", async () => {
    const [inq] = await db.insert(inquiries).values({ professionalId: p2, requesterUserId: OTHER.userId, kind: "quote", status: "confirmed", requesterName: "Other", requesterEmail: OTHER.email, eventTypeLabel: "Anniversaire", eventDate: addDays(today, -3), message: "Une demande confirmée par le professionnel." }).returning({ id: inquiries.id });
    const ops = await listReviewOpportunities(OTHER);
    expect(ops.find((o) => o.inquiryId === inq!.id)).toBeTruthy();
    const { id } = await createVerifiedReview(OTHER, { professionalId: p2, inquiryId: inq!.id, eventId: null, rating: 4, title: "Bien", body: "Buffet copieux, service discret, rien à redire sur l'organisation." });
    await db.update(professionalReviews).set({ status: "published" }).where(eq(professionalReviews.id, id));
    await db.insert(professionalReviews).values({ professionalId: p2, authorUserId: P3.userId, rating: 1, body: "Avis sans aucune prestation derrière lui.", status: "published" });
    const shown = await listPublishedReviews(p2);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.verifiedLabel).toMatch(/^Anniversaire, /);
  });
});

describe("live day", () => {
  it("propagates a delay, notifies the trades concerned and limits providers to their steps", async () => {
    const ev = await eventOn(ORG, "net live", addDays(today, 5));
    await addMember(ev, DJ, "provider", "dj");
    const [a, b, c] = await db
      .insert(eventMilestones)
      .values([
        { eventId: ev, title: "Cérémonie", startsAt: new Date("2027-01-01T13:00:00Z"), endsAt: new Date("2027-01-01T14:00:00Z"), categorySlugs: [] },
        { eventId: ev, title: "Vin d'honneur", startsAt: new Date("2027-01-01T14:15:00Z"), endsAt: new Date("2027-01-01T16:00:00Z"), categorySlugs: ["traiteur"] },
        { eventId: ev, title: "Soirée", startsAt: new Date("2027-01-01T20:00:00Z"), endsAt: null, categorySlugs: ["dj"] },
      ])
      .returning({ id: eventMilestones.id });
    await setDependency(ORG, ev, b!.id, a!.id);
    await setDependency(ORG, ev, c!.id, b!.id);
    await expect(setDependency(ORG, ev, a!.id, c!.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(setDependency(DJ, ev, b!.id, null)).rejects.toBeInstanceOf(ForbiddenError); // member without the permission
    await expect(reportDelay(DJ, ev, b!.id, 10)).rejects.toBeInstanceOf(ForbiddenError);

    await reportDelay(ORG, ev, a!.id, 45);
    const live = await getLiveDay(ORG, ev);
    const byTitle = new Map(live.steps.map((s) => [s.title, s]));
    expect(byTitle.get("Vin d'honneur")?.timing.shiftMinutes).toBe(30);
    expect(byTitle.get("Soirée")?.timing.shiftMinutes).toBe(0);
    const n = await db.select().from(notifications).where(and(eq(notifications.userId, DJ.userId), eq(notifications.type, "schedule_changed")));
    // A step without trade concerns everyone: the DJ hears about the ceremony, not about the evening (not moved).
    expect(n).toHaveLength(1);
    expect(n[0]?.body).toContain("Cérémonie");
    expect(n[0]?.body).not.toContain("Soirée");
    expect(n[0]?.body).not.toContain("Vin d'honneur");

    await reportDelay(ORG, ev, b!.id, 240); // ends exactly at 20:00: the evening still starts on time
    expect((await getLiveDay(ORG, ev)).steps.find((s) => s.title === "Soirée")?.timing.shiftMinutes).toBe(0);
    await reportDelay(ORG, ev, b!.id, 20);
    expect((await getLiveDay(ORG, ev)).steps.find((s) => s.title === "Soirée")?.timing.shiftMinutes).toBe(20);
    const n2 = await db.select().from(notifications).where(and(eq(notifications.userId, DJ.userId), eq(notifications.type, "schedule_changed")));
    expect(n2.some((x) => x.body?.includes("Soirée"))).toBe(true);
    await setLiveStatus(DJ, ev, c!.id, "in_progress");
    await expect(setLiveStatus(DJ, ev, c!.id, "in_progress")).rejects.toBeInstanceOf(ConflictError);
    await expect(reportDelay(ORG, ev, a!.id, 2)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("self-updating budget", () => {
  it("turns an accepted quote into a budget line, an expense and dated payments, once", async () => {
    const ev = await eventOn(ORG, "net budget", addDays(today, 200));
    const [inq] = await db.insert(inquiries).values({ professionalId: p1, requesterUserId: ORG.userId, eventId: ev, kind: "quote", status: "viewed", requesterName: "Org", requesterEmail: ORG.email, message: "Demande de devis pour le budget." }).returning({ id: inquiries.id });
    await sendQuote(P1, p1, inq!.id, { quoteCents: 0, structured: toStructuredQuote(quoteFormSchema.parse({ totalEuros: 5000, depositEuros: 1500, balanceDueDays: 30 })) });
    await answerQuote(ORG, ev, inq!.id, "accepted");
    await recordAcceptedQuoteInBudget(ev, inq!.id, db); // replay: no duplicate

    const lines = await db.select().from(eventBudgetLines).where(eq(eventBudgetLines.eventId, ev));
    expect(lines.filter((l) => l.plannedCents === 500_000)).toHaveLength(1);
    expect(await db.select().from(eventExpenses).where(eq(eventExpenses.eventId, ev))).toHaveLength(1);
    const { items } = await listPaymentItems(ORG, ev);
    expect(items.map((i) => [i.kind, i.amountCents, i.dueDate])).toEqual([
      ["deposit", 150_000, today],
      ["balance", 350_000, addDays(addDays(today, 200), -30)],
    ]);

    // Reminder a week before the balance.
    await db.update(eventPaymentItems).set({ dueDate: addDays(today, 7) }).where(and(eq(eventPaymentItems.eventId, ev), eq(eventPaymentItems.kind, "balance")));
    expect(await remindUpcomingPayments()).toBeGreaterThanOrEqual(1);
    const [n] = await db.select().from(notifications).where(and(eq(notifications.userId, ORG.userId), like(notifications.title, "Paiement dans 7 jours%")));
    expect(n).toBeTruthy();

    for (const i of items) await markPaymentPaid(ORG, ev, i.id, today);
    const [exp] = await db.select().from(eventExpenses).where(eq(eventExpenses.eventId, ev));
    expect(exp?.status).toBe("paid");
    await expect(markPaymentPaid(OTHER, ev, items[0]!.id, today)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("professional network", () => {
  it("recommends published partners only, once, and computes often booked with on two events", async () => {
    await addRecommendation(P1, p1, p2, "Toujours fiable");
    await expect(addRecommendation(P1, p1, p2, "")).rejects.toBeInstanceOf(ConflictError);
    await expect(addRecommendation(P1, p1, p1, "")).rejects.toBeInstanceOf(ValidationError);
    await expect(addRecommendation(P1, p1, p3, "")).rejects.toBeInstanceOf(NotFoundError);
    await expect(addRecommendation(P2, p1, p2, "")).rejects.toBeInstanceOf(NotFoundError);
    expect((await getRecommendedPartners(p1)).map((r) => r.note)).toEqual(["Toujours fiable"]);

    expect(await getOftenBookedWith(p1)).toEqual([]);
    await eventOn(OTHER, "net co 1", addDays(today, -40), [{ id: p1 }, { id: p2 }]);
    expect(await getOftenBookedWith(p1)).toEqual([]); // one shared event is not enough
    await eventOn(OTHER, "net co 2", addDays(today, -20), [{ id: p1 }, { id: p2 }]);
    expect((await getOftenBookedWith(p1)).map((x) => [x.id, x.events])).toEqual([[p2, 2]]);

    const [mine] = await listMyRecommendations(P1, p1);
    await removeRecommendation(P1, p1, mine!.recommendationId);
    expect(await getRecommendedPartners(p1)).toEqual([]);
  });
});

describe("booking retroplanning", () => {
  it("dates bookings back from the event, knows what is booked and adds the rest as tasks once", async () => {
    const ev = await eventOn(ORG, "net retro", addDays(today, 300), [{ id: p1 }]);
    await db.update(events).set({ type: "wedding" }).where(eq(events.id, ev));
    const view = await getRetroplanning(ORG, ev);
    expect(view.items.find((i) => i.categorySlug === "traiteur")?.state).toBe("booked");
    expect(view.items.find((i) => i.categorySlug === "domaine-reception")?.state).toBe("late");
    const { created } = await addRetroplanningTasks(ORG, ev);
    expect(created).toBe(view.items.length - 1);
    const tasks = await db.select().from(eventTasks).where(and(eq(eventTasks.eventId, ev), eq(eventTasks.section, "Réservations")));
    expect(tasks.find((t) => t.title === "Réserver le lieu de réception")?.dueDate).toBe(today);
    expect((await addRetroplanningTasks(ORG, ev)).created).toBe(0);
    await expect(getRetroplanning(OTHER, ev)).rejects.toBeInstanceOf(NotFoundError);
    void djCat;
  });
});
