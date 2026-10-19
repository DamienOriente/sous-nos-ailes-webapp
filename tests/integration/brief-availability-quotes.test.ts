/**
 * Shared brief, real availability with 48-hour options, structured quotes and comparison.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { calendarEntries, emailOutbox, eventProfessionals, events, inquiries, inquiryQuotes, professionalAvailability, professionalCategories, professionalHolds, professionals } from "@/db/schema";
import { ConflictError, NotFoundError, RateLimitedError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { availabilityOn } from "@/modules/directory/application/availability";
import { searchDirectory } from "@/modules/directory/application/directory-search";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { getBriefPage, updateBrief } from "@/modules/events/application/brief-service";
import { briefUpdateSchema } from "@/modules/events/domain/brief";
import { confirmHold, expireHolds, placeHold, releaseHold } from "@/modules/inquiries/application/hold-service";
import { answerQuote, createPublicInquiry, getEventQuoteComparison, sendBriefToProfessionals, sendQuote } from "@/modules/inquiries/application/inquiry-service";
import { quoteFormSchema, toStructuredQuote } from "@/modules/inquiries/domain/quote";
import { cleanupUsers, createEvent, createUser } from "./_fixtures";

const DATE = "2027-09-18"; // a Saturday
let ORG: Actor, OTHER: Actor, PRO1: Actor, PRO2: Actor, PRO3: Actor;
let eventId: string;
let p1: string, p2: string, p3: string;
const actors = () => [ORG, OTHER, PRO1, PRO2, PRO3];

async function listing(owner: Actor, name: string, categoryId: string) {
  const [row] = await db
    .insert(professionals)
    .values({ ownerUserId: owner.userId, slug: `itest-${randomUUID().slice(0, 8)}`, displayName: `Itest Brief ${name}`, primaryCategoryId: categoryId, status: "published", publishedAt: new Date(), city: "Albi", postalCode: "81000", department: "81", isDemo: true })
    .returning({ id: professionals.id });
  return row!.id;
}

beforeAll(async () => {
  ORG = await createUser("brief-org");
  OTHER = await createUser("brief-other");
  PRO1 = await createUser("brief-pro1");
  PRO2 = await createUser("brief-pro2");
  PRO3 = await createUser("brief-pro3");
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, "traiteur")).limit(1);
  if (!cat) throw new Error("reference data missing: run pnpm db:seed first");
  p1 = await listing(PRO1, "Un", cat.id);
  p2 = await listing(PRO2, "Deux", cat.id);
  p3 = await listing(PRO3, "Trois", cat.id);
  eventId = await createEvent(ORG, "brief");
  await db.update(events).set({ eventDate: DATE, city: "Albi", expectedGuests: 100, budgetCents: 2_000_000 }).where(eq(events.id, eventId));
});

afterAll(async () => {
  const owners = actors().map((a) => a.userId);
  await db.delete(professionalHolds).where(inArray(professionalHolds.requesterUserId, owners));
  await db.delete(calendarEntries).where(inArray(calendarEntries.ownerUserId, owners));
  await db.delete(professionals).where(inArray(professionals.ownerUserId, owners));
  await cleanupUsers(actors());
  // Pending e-mails would otherwise crowd the outbox drain of other test files.
  await db.delete(emailOutbox).where(like(emailOutbox.toEmail, "itest-brief-%"));
});

describe("shared brief", () => {
  it("is edited once and keeps the budget private unless shared", async () => {
    await updateBrief(ORG, eventId, briefUpdateSchema.parse({ style: "Guinguette", preferences: "Dîner assis", expectedGuests: 100, expectedChildren: 8, budgetEuros: 20000, briefShareBudget: false, city: "Albi", postalCode: "81000", eventDate: DATE }));
    const page = await getBriefPage(ORG, eventId);
    expect(page.brief).toMatchObject({ style: "Guinguette", guests: 100, children: 8, city: "Albi", budgetCents: null });
    await expect(updateBrief(OTHER, eventId, briefUpdateSchema.parse({ eventDate: DATE }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is sent to several professionals in one go, frozen on each inquiry, never twice", async () => {
    const res = await sendBriefToProfessionals(ORG, eventId, { professionalIds: [p1, p2], kind: "quote", message: "" });
    expect(res.sent).toHaveLength(2);
    const rows = await db.select().from(inquiries).where(eq(inquiries.eventId, eventId));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => (r.brief as { style?: string } | null)?.style === "Guinguette")).toBe(true);
    expect(rows[0]?.guestsCount).toBe(100);
    const again = await sendBriefToProfessionals(ORG, eventId, { professionalIds: [p1, p3], kind: "quote", message: "Merci" });
    expect(again.sent).toHaveLength(1);
    expect(again.skipped).toEqual([{ professionalId: p1, reason: "already_contacted" }]);
    await expect(sendBriefToProfessionals(OTHER, eventId, { professionalIds: [p2], kind: "quote", message: "" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("replaces typed details by the brief on the public form, only for the organiser", async () => {
    await db.delete(inquiries).where(and(eq(inquiries.eventId, eventId), eq(inquiries.professionalId, p3)));
    const { id } = await createPublicInquiry({ professionalId: p3, kind: "contact", requesterName: "Org", requesterEmail: ORG.email, eventCity: "Paris", guestsCount: 3, message: "", consent: true, website: "", eventId }, ORG);
    const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id));
    expect(row).toMatchObject({ eventCity: "Albi", guestsCount: 100, eventId });
    // Someone else's event: ignored, so a real message is required.
    await expect(createPublicInquiry({ professionalId: p3, kind: "contact", requesterName: "X", requesterEmail: OTHER.email, message: "", consent: true, website: "", eventId }, OTHER)).rejects.toThrow(/10 caractères/);
  });
});

describe("real availability", () => {
  it("combines the weekly grid, declared unavailability, bookings and synced calendars", async () => {
    const free = await availabilityOn([p1, p2, p3], DATE, null);
    expect([...free.values()].every((a) => a.available)).toBe(true);

    await db.insert(professionalAvailability).values({ professionalId: p1, weekday: 0, startMinute: 540, endMinute: 1080 }); // Mondays only
    await db.insert(calendarEntries).values({ ownerUserId: PRO2.userId, title: "Mariage ailleurs (agenda Google)", startsAt: new Date(`${DATE}T10:00:00Z`), endsAt: new Date(`${DATE}T22:00:00Z`), icalUid: `itest-${randomUUID()}`, sourceConnectionId: randomUUID() });
    const other = await createEvent(OTHER, "booking");
    await db.update(events).set({ eventDate: DATE }).where(eq(events.id, other));
    await db.insert(eventProfessionals).values({ eventId: other, professionalId: p3, status: "confirmed" });

    const busy = await availabilityOn([p1, p2, p3], DATE, null);
    expect(busy.get(p1)?.reason).toBe("closed");
    expect(busy.get(p2)?.reason).toBe("calendar");
    expect(busy.get(p3)?.reason).toBe("booked");

    const search = await searchDirectory(parseSearchParams({ q: "Itest Brief", date: DATE }));
    expect(search.items.map((i) => i.id)).not.toEqual(expect.arrayContaining([p1]));
    expect(search.items.map((i) => i.id)).not.toContain(p2);
    expect(search.items.map((i) => i.id)).not.toContain(p3);

    await db.delete(professionalAvailability).where(eq(professionalAvailability.professionalId, p1));
    await db.delete(calendarEntries).where(eq(calendarEntries.ownerUserId, PRO2.userId));
    await db.delete(events).where(eq(events.id, other));
  });
});

describe("48-hour options", () => {
  it("blocks the date for others, stays available to the holder, is race-free", async () => {
    const results = await Promise.allSettled([placeHold(ORG, { professionalId: p1, date: DATE, eventId }), placeHold(OTHER, { professionalId: p1, date: DATE })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const winner = results[0]?.status === "fulfilled" ? ORG : OTHER;
    const loser = winner === ORG ? OTHER : ORG;
    const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(err.reason).toBeInstanceOf(ConflictError);
    expect((await availabilityOn([p1], DATE, loser.userId)).get(p1)).toMatchObject({ available: false, reason: "held" });
    expect((await availabilityOn([p1], DATE, winner.userId)).get(p1)).toMatchObject({ available: true, reason: "held_by_you" });
    const ids = (await searchDirectory(parseSearchParams({ q: "Itest Brief", date: DATE }), loser.userId)).items.map((i) => i.id);
    expect(ids).not.toContain(p1);
    // Placing it again is idempotent for the holder.
    const again = await placeHold(winner, { professionalId: p1, date: DATE });
    expect(again.status).toBe("active");
    const [h] = await db.select().from(professionalHolds).where(and(eq(professionalHolds.professionalId, p1), eq(professionalHolds.requesterUserId, winner.userId)));
    await releaseHold(winner, h!.id);
    expect((await availabilityOn([p1], DATE, loser.userId)).get(p1)?.available).toBe(true);
  });

  it("is confirmed by the professional, lapses on its own, and is limited per organiser", async () => {
    const hold = await placeHold(ORG, { professionalId: p2, date: DATE, eventId });
    await expect(confirmHold(PRO1, hold.id)).rejects.toBeInstanceOf(NotFoundError);
    await confirmHold(PRO2, hold.id);
    expect((await availabilityOn([p2], DATE, OTHER.userId)).get(p2)?.reason).toBe("held");

    const lapsing = await placeHold(ORG, { professionalId: p3, date: "2027-09-25" });
    await db.update(professionalHolds).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(professionalHolds.id, lapsing.id));
    expect((await availabilityOn([p3], "2027-09-25", OTHER.userId)).get(p3)?.available).toBe(true);
    expect(await expireHolds()).toBeGreaterThanOrEqual(1);

    await expect(placeHold(PRO1, { professionalId: p1, date: DATE })).rejects.toThrow(/propre fiche/);
    await expect(placeHold(ORG, { professionalId: p1, date: "2020-01-01" })).rejects.toThrow(/passée/);
    const dates = ["2027-10-02", "2027-10-09", "2027-10-16", "2027-10-23", "2027-10-30"];
    for (const d of dates.slice(0, 4)) await placeHold(OTHER, { professionalId: p3, date: d });
    await placeHold(OTHER, { professionalId: p1, date: dates[4]! });
    await expect(placeHold(OTHER, { professionalId: p2, date: "2027-11-06" })).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("structured quotes and comparison", () => {
  it("keeps versions, compares the latest side by side and lets the organiser answer", async () => {
    const [i1] = await db.select({ id: inquiries.id }).from(inquiries).where(and(eq(inquiries.eventId, eventId), eq(inquiries.professionalId, p1)));
    const [i2] = await db.select({ id: inquiries.id }).from(inquiries).where(and(eq(inquiries.eventId, eventId), eq(inquiries.professionalId, p2)));
    const q = (o: object) => toStructuredQuote(quoteFormSchema.parse(o));
    await sendQuote(PRO1, p1, i1!.id, { quoteCents: 0, structured: q({ lines: [{ label: "Menu", quantity: 100, unitEuros: 90 }], inclusions: "Vaisselle\nService", depositEuros: 2700 }) });
    const v2 = await sendQuote(PRO1, p1, i1!.id, { quoteCents: 0, structured: q({ lines: [{ label: "Menu", quantity: 100, unitEuros: 85 }], inclusions: "Vaisselle\nService", depositEuros: 2550 }) });
    expect(v2.version).toBe(2);
    await sendQuote(PRO2, p2, i2!.id, { quoteCents: 0, structured: q({ totalEuros: 8000, inclusions: "vaisselle", exclusions: "Service", validUntil: "2026-01-01" }) });
    expect(await db.select().from(inquiryQuotes).where(eq(inquiryQuotes.inquiryId, i1!.id))).toHaveLength(2);

    const cmp = await getEventQuoteComparison(ORG, eventId);
    const g = cmp.groups.find((x) => x.categorySlug === "traiteur")!;
    const byId = new Map(g.comparison.quotes.map((x) => [x.inquiryId, x]));
    // The other quote has expired: no "cheapest" label with a single valid quote.
    expect(byId.get(i1!.id)).toMatchObject({ totalCents: 850_000, version: 2, perGuestCents: 8500, depositPercent: 30, cheapest: false });
    expect(byId.get(i2!.id)).toMatchObject({ expired: true, cheapest: false });
    expect(g.comparison.matrix.Service).toEqual(g.comparison.quotes.map((x) => (x.inquiryId === i1!.id ? "included" : "excluded")));
    await expect(getEventQuoteComparison(OTHER, eventId)).rejects.toBeInstanceOf(NotFoundError);

    await expect(answerQuote(ORG, eventId, i2!.id, "accepted")).rejects.toThrow(/expiré/);
    await answerQuote(ORG, eventId, i1!.id, "accepted");
    const [after] = await db.select({ status: inquiries.status }).from(inquiries).where(eq(inquiries.id, i1!.id));
    expect(after?.status).toBe("accepted");
    await expect(answerQuote(ORG, eventId, i1!.id, "declined")).rejects.toBeInstanceOf(ConflictError);
  });
});
