import { and, asc, eq, inArray, isNotNull, isNull, notInArray, or } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventProfessionals, events, inquiries, professionalCategories, professionalFavorites, professionals } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { availabilityOn, type DayAvailability } from "@/modules/directory/application/availability";
import { isPublicListing } from "@/modules/directory/application/public-listing";
import { buildBrief, missingBriefFields, type BriefUpdateInput, type EventBrief } from "@/modules/events/domain/brief";
import { recordAudit } from "./audit";

export type BriefTarget = {
  professionalId: string;
  displayName: string;
  slug: string;
  categoryName: string;
  source: "shortlist" | "favorite";
  openInquiryStatus: string | null;
  availability: DayAvailability | null;
};

export type BriefPage = {
  event: { id: string; name: string; eventDate: string | null; style: string | null; preferences: string | null; expectedGuests: number | null; expectedChildren: number | null; budgetCents: number | null; briefShareBudget: boolean; venueName: string | null; city: string | null; postalCode: string | null; briefUpdatedAt: Date | null };
  brief: EventBrief;
  missing: string[];
  targets: BriefTarget[];
};

async function loadEvent(eventId: string, executor: DbExecutor) {
  const [e] = await executor.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  if (!e) throw new NotFoundError();
  return e;
}

/** Brief editor data: the brief as providers will receive it, and who it can be sent to. */
export async function getBriefPage(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<BriefPage> {
  await requireEventPermission(actor, eventId, "event.inquiries.view", executor);
  const e = await loadEvent(eventId, executor);
  const brief = buildBrief(e);

  const shortlist = await executor
    .select({ professionalId: eventProfessionals.professionalId })
    .from(eventProfessionals)
    .where(and(eq(eventProfessionals.eventId, eventId), isNotNull(eventProfessionals.professionalId), notInArray(eventProfessionals.status, ["cancelled", "declined", "confirmed"])));
  // Providers already confirmed on this event need no brief; favourites who are, neither.
  const confirmed = new Set(
    (
      await executor
        .select({ professionalId: eventProfessionals.professionalId })
        .from(eventProfessionals)
        .where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.status, "confirmed")))
    ).map((r) => r.professionalId),
  );
  const favorites = await executor.select({ professionalId: professionalFavorites.professionalId }).from(professionalFavorites).where(eq(professionalFavorites.userId, actor.userId));
  const source = new Map<string, "shortlist" | "favorite">();
  for (const s of shortlist) if (s.professionalId) source.set(s.professionalId, "shortlist");
  for (const f of favorites) if (!source.has(f.professionalId)) source.set(f.professionalId, "favorite");
  for (const id of confirmed) if (id) source.delete(id);
  const ids = [...source.keys()];

  const pros = ids.length
    ? await executor
        .select({ id: professionals.id, displayName: professionals.displayName, slug: professionals.slug, categoryName: professionalCategories.name })
        .from(professionals)
        .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
        .where(and(inArray(professionals.id, ids), isPublicListing()))
        .orderBy(asc(professionalCategories.sortOrder), asc(professionals.displayName))
    : [];
  const open = pros.length
    ? await executor
        .select({ professionalId: inquiries.professionalId, status: inquiries.status })
        .from(inquiries)
        .where(and(eq(inquiries.eventId, eventId), inArray(inquiries.professionalId, pros.map((p) => p.id)), or(notInArray(inquiries.status, ["declined", "archived"]))))
    : [];
  const openByPro = new Map(open.map((o) => [o.professionalId, o.status]));
  const avail = e.eventDate && pros.length ? await availabilityOn(pros.map((p) => p.id), e.eventDate, actor.userId, executor, eventId) : new Map<string, DayAvailability>();

  return {
    event: { id: e.id, name: e.name, eventDate: e.eventDate, style: e.style, preferences: e.preferences, expectedGuests: e.expectedGuests, expectedChildren: e.expectedChildren, budgetCents: e.budgetCents, briefShareBudget: e.briefShareBudget, venueName: e.venueName, city: e.city, postalCode: e.postalCode, briefUpdatedAt: e.briefUpdatedAt },
    brief,
    missing: missingBriefFields(brief),
    targets: pros.map((p) => ({ professionalId: p.id, displayName: p.displayName, slug: p.slug, categoryName: p.categoryName, source: source.get(p.id) ?? "favorite", openInquiryStatus: openByPro.get(p.id) ?? null, availability: avail.get(p.id) ?? null })),
  };
}

/** Updates the brief fields of the event (they are the event's own fields: one source of truth). */
export async function updateBrief(actor: Actor, eventId: string, input: BriefUpdateInput): Promise<void> {
  await db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.edit", tx);
    await loadEvent(eventId, tx);
    await tx
      .update(events)
      .set({
        style: input.style || null,
        preferences: input.preferences || null,
        expectedGuests: input.expectedGuests ?? null,
        expectedChildren: input.expectedChildren ?? null,
        budgetCents: input.budgetEuros === null || input.budgetEuros === undefined ? null : Math.round(input.budgetEuros * 100),
        briefShareBudget: input.briefShareBudget,
        venueName: input.venueName || null,
        city: input.city || null,
        postalCode: input.postalCode || null,
        eventDate: input.eventDate || null,
        briefUpdatedAt: new Date(),
      })
      .where(eq(events.id, eventId));
    await recordAudit({ actorUserId: actor.userId, action: "event.brief_updated", resourceType: "event", resourceId: eventId, eventId, metadata: { shareBudget: input.briefShareBudget } }, tx);
  });
}

const ORGANIZER_ROLES = ["owner", "lead_organizer", "co_organizer", "wedding_planner"] as const;

/** Upcoming events the actor organises (brief attachment, options), soonest first. */
export async function listOrganizedEvents(actor: Actor, executor: DbExecutor = db): Promise<{ id: string; name: string; eventDate: string | null }[]> {
  return executor
    .select({ id: events.id, name: events.name, eventDate: events.eventDate })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(and(eq(eventMembers.userId, actor.userId), eq(eventMembers.status, "active"), inArray(eventMembers.role, [...ORGANIZER_ROLES]), isNull(events.deletedAt), inArray(events.status, ["planning", "confirmed"])))
    .orderBy(asc(events.eventDate));
}
