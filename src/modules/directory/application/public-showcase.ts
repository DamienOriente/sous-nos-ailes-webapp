import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventChildren, eventGuests, eventMembers, eventMilestones, eventProfessionals, eventTasks, events, professionalCategories, professionalReviews, professionals, seatingTables, users } from "@/db/schema";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { searchDirectory, type DirectoryCard } from "./directory-search";

/**
 * Read-only queries feeding the public marketing pages with REAL rows from the
 * database (demo rows included, always flagged with `isDemo`) so the site shows
 * concrete examples without inventing a single name, number or testimonial.
 */

/**
 * Up to `limit` published listings with distinct trades, childcare first, then
 * the best ranked of the remaining trades. Reuses the directory ranking so the
 * home page never contradicts the directory.
 */
export async function listFeaturedProfessionals(limit = 3, executor: DbExecutor = db): Promise<DirectoryCard[]> {
  const result = await searchDirectory(parseSearchParams({}), null, executor);
  const childcareSlugs = new Set(["garde-enfants-evenementielle", "baby-sitting", "animation-enfants"]);
  const picked: DirectoryCard[] = [];
  const seen = new Set<string>();
  const take = (p: DirectoryCard) => {
    if (seen.has(p.categorySlug) || picked.length >= limit) return;
    seen.add(p.categorySlug);
    picked.push(p);
  };
  for (const p of result.items) if (childcareSlugs.has(p.categorySlug)) take(p);
  for (const p of result.items) if (!childcareSlugs.has(p.categorySlug)) take(p);
  return picked;
}

export type PublishedReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  /** First name + initial only: the author is a person, not a marketing asset. */
  authorLabel: string;
  professional: { slug: string; displayName: string; categoryName: string; categorySlug: string; isDemo: boolean };
};

function authorLabel(fullName: string): string {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]?.toUpperCase() ?? ""}.` : first;
}

/** Published reviews only (moderated), newest first, with the listing they belong to. */
export async function listPublishedReviews(limit = 3, executor: DbExecutor = db): Promise<PublishedReview[]> {
  const rows = await executor
    .select({
      id: professionalReviews.id,
      rating: professionalReviews.rating,
      title: professionalReviews.title,
      body: professionalReviews.body,
      authorName: users.name,
      slug: professionals.slug,
      displayName: professionals.displayName,
      isDemo: professionals.isDemo,
      categoryName: professionalCategories.name,
      categorySlug: professionalCategories.slug,
    })
    .from(professionalReviews)
    .innerJoin(professionals, and(eq(professionals.id, professionalReviews.professionalId), eq(professionals.status, "published"), isNull(professionals.deletedAt)))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .innerJoin(users, eq(users.id, professionalReviews.authorUserId))
    .where(eq(professionalReviews.status, "published"))
    .orderBy(desc(professionalReviews.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorLabel: authorLabel(r.authorName),
    professional: { slug: r.slug, displayName: r.displayName, categoryName: r.categoryName, categorySlug: r.categorySlug, isDemo: r.isDemo },
  }));
}

export type EventShowcase = {
  id: string;
  name: string;
  type: string;
  eventDate: string | null;
  city: string | null;
  venueName: string | null;
  expectedGuests: number | null;
  isDemo: boolean;
  guests: { total: number; accepted: number; declined: number; pending: number };
  /** First name + age only: exactly what the platform stores about a child, nothing more. */
  children: { total: number; youngest: number | null; oldest: number | null; list: Array<{ firstName: string; ageYears: number }> };
  careTeam: number;
  providers: { confirmed: number; pending: number; list: Array<{ name: string; category: string | null; status: string }> };
  tasks: { done: number; total: number; sections: Array<{ section: string; done: number; total: number }> };
  milestones: Array<{ title: string; startsAt: Date; location: string | null }>;
  seating: { tables: Array<{ name: string; shape: string; capacity: number; seated: number; x: number; y: number }>; seated: number };
};

/**
 * The demo event with the largest team (the seeded wedding): a real-looking
 * coordination snapshot for the marketing pages. Only `isDemo` events are
 * eligible: a real organiser's event is never shown publicly.
 */
export async function getDemoEventShowcase(executor: DbExecutor = db): Promise<EventShowcase | null> {
  // Correlated subqueries reference the outer table as `${table}.column`: Drizzle renders a bare
  // `${table.column}` unqualified in single-table selects, which the subquery alias then shadows.
  const [ev] = await executor
    .select({
      id: events.id,
      name: events.name,
      type: events.type,
      eventDate: events.eventDate,
      city: events.city,
      venueName: events.venueName,
      expectedGuests: events.expectedGuests,
      isDemo: events.isDemo,
      members: sql<number>`(select count(*) from event_members m where m.event_id = ${events}.id and m.status = 'active')::int`,
    })
    .from(events)
    .where(and(eq(events.isDemo, true), isNull(events.deletedAt), inArray(events.status, ["planning", "confirmed", "in_progress"])))
    .orderBy(desc(sql`(select count(*) from event_members m where m.event_id = ${events}.id and m.status = 'active')`), asc(events.eventDate))
    .limit(1);
  if (!ev) return null;
  const eid = ev.id;

  const [guestRows, childRows, childList, careRows, providerRows, taskRows, milestoneRows, tableRows] = await Promise.all([
    executor.select({ status: eventGuests.rsvpStatus, n: sql<number>`count(*)::int` }).from(eventGuests).where(eq(eventGuests.eventId, eid)).groupBy(eventGuests.rsvpStatus),
    executor.select({ n: sql<number>`count(*)::int`, min: sql<number | null>`min(${eventChildren.ageYears})::int`, max: sql<number | null>`max(${eventChildren.ageYears})::int` }).from(eventChildren).where(eq(eventChildren.eventId, eid)),
    executor.select({ firstName: eventChildren.firstName, ageYears: eventChildren.ageYears }).from(eventChildren).where(eq(eventChildren.eventId, eid)).orderBy(asc(eventChildren.ageYears), asc(eventChildren.firstName)).limit(12),
    executor
      .select({ n: sql<number>`count(*)::int` })
      .from(eventMembers)
      .where(and(eq(eventMembers.eventId, eid), eq(eventMembers.status, "active"), inArray(eventMembers.role, ["staff", "provider"]), sql`exists (select 1 from child_care_assignments a where a.member_id = ${eventMembers}.id)`)),
    executor
      .select({ status: eventProfessionals.status, name: sql<string | null>`coalesce(${professionals.displayName}, ${eventProfessionals.externalName})`, category: professionalCategories.name })
      .from(eventProfessionals)
      .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
      .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
      .where(eq(eventProfessionals.eventId, eid))
      .orderBy(asc(eventProfessionals.createdAt)),
    executor
      .select({ section: eventTasks.section, status: eventTasks.status, n: sql<number>`count(*)::int` })
      .from(eventTasks)
      .where(eq(eventTasks.eventId, eid))
      .groupBy(eventTasks.section, eventTasks.status),
    executor.select({ title: eventMilestones.title, startsAt: eventMilestones.startsAt, location: eventMilestones.location }).from(eventMilestones).where(eq(eventMilestones.eventId, eid)).orderBy(asc(eventMilestones.startsAt)).limit(8),
    executor
      .select({ name: seatingTables.name, shape: seatingTables.shape, capacity: seatingTables.capacity, x: seatingTables.x, y: seatingTables.y, seated: sql<number>`(select count(*) from seating_assignments a where a.table_id = ${seatingTables}.id)::int` })
      .from(seatingTables)
      .where(eq(seatingTables.eventId, eid))
      .orderBy(asc(seatingTables.sortOrder))
      .limit(12),
  ]);

  const guests = { total: 0, accepted: 0, declined: 0, pending: 0 };
  for (const g of guestRows) {
    guests.total += g.n;
    if (g.status === "accepted") guests.accepted += g.n;
    else if (g.status === "declined") guests.declined += g.n;
    else guests.pending += g.n;
  }

  const sections = new Map<string, { done: number; total: number }>();
  let done = 0;
  let total = 0;
  for (const t of taskRows) {
    if (t.status === "cancelled") continue;
    const key = t.section ?? "Autres";
    const s = sections.get(key) ?? { done: 0, total: 0 };
    s.total += t.n;
    total += t.n;
    if (t.status === "done") {
      s.done += t.n;
      done += t.n;
    }
    sections.set(key, s);
  }

  const providerList = providerRows.filter((p): p is typeof p & { name: string } => Boolean(p.name)).map((p) => ({ name: p.name, category: p.category, status: p.status }));
  const confirmed = providerRows.filter((p) => p.status === "confirmed").length;
  const pending = providerRows.filter((p) => p.status === "requested" || p.status === "quoted" || p.status === "shortlisted").length;

  return {
    id: ev.id,
    name: ev.name,
    type: ev.type,
    eventDate: ev.eventDate,
    city: ev.city,
    venueName: ev.venueName,
    expectedGuests: ev.expectedGuests,
    isDemo: ev.isDemo,
    guests,
    children: { total: childRows[0]?.n ?? 0, youngest: childRows[0]?.min ?? null, oldest: childRows[0]?.max ?? null, list: childList },
    careTeam: careRows[0]?.n ?? 0,
    providers: { confirmed, pending, list: providerList },
    tasks: { done, total, sections: [...sections.entries()].map(([section, s]) => ({ section, ...s })) },
    milestones: milestoneRows,
    seating: { tables: tableRows, seated: tableRows.reduce((n, t) => n + t.seated, 0) },
  };
}
