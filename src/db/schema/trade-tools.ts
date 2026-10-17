import { boolean, index, integer, jsonb, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { events, eventMembers, eventMilestones } from "./events";
import { calendarEntries } from "./calendar";

/**
 * Tables owned by the childcare / calendar / trade-tools agent.
 *
 * 1. Calendar additions (the base calendar schema in calendar.ts is shared and
 *    frozen): reminder dispatch ledger and OAuth state storage.
 * 2. Trade-specific tools scoped to an event: catering, venue, music,
 *    equipment, images. Every row is keyed by event_id so the authorization
 *    layer (requireEventPermission / trade access) can filter by event.
 *
 * No health data, no secrets, no document contents live in these tables.
 */

// ── Calendar additions ──────────────────────────────────────────────────────

/**
 * One row per (entry, occurrence) once its reminder has been dispatched, so a
 * recurring entry gets one reminder per occurrence and never twice.
 */
export const calendarReminderDispatches = pgTable(
  "calendar_reminder_dispatches",
  {
    id: id(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => calendarEntries.id, { onDelete: "cascade" }),
    occurrenceStartsAt: tsz("occurrence_starts_at").notNull(),
    dispatchedAt: tsz("dispatched_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("calendar_reminder_dispatches_uq").on(t.entryId, t.occurrenceStartsAt)],
);

// ── Catering ────────────────────────────────────────────────────────────────

/** One plan per event: headcount adjustments, meal split, logistics text. */
export const cateringPlans = pgTable(
  "catering_plans",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Manual additions to the counts derived from accepted guests (staff meals, late RSVPs…). */
    manualAdults: integer("manual_adults").notNull().default(0),
    manualChildren: integer("manual_children").notNull().default(0),
    /** Covers per meal moment: { cocktail, dinner, brunch }. */
    mealSplit: jsonb("meal_split").$type<{ cocktail: number; dinner: number; brunch: number }>().notNull().default({ cocktail: 0, dinner: 0, brunch: 0 }),
    deliveryNotes: text("delivery_notes"),
    equipmentNotes: text("equipment_notes"),
    constraints: text("constraints"),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("catering_plans_event_uq").on(t.eventId)],
);

export const cateringMenus = pgTable(
  "catering_menus",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** cocktail | dinner | brunch | children | other */
    moment: text("moment").notNull().default("dinner"),
    name: text("name").notNull(),
    description: text("description"),
    /** Indicative price per cover, cents. */
    pricePerCoverCents: integer("price_per_cover_cents"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("catering_menus_event_idx").on(t.eventId)],
);

/** Service timeline of the caterer ("Cocktail 18h30", "Entrée 20h15"...). */
export const cateringServiceSteps = pgTable(
  "catering_service_steps",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: tsz("starts_at").notNull(),
    endsAt: tsz("ends_at"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("catering_service_steps_event_idx").on(t.eventId, t.startsAt)],
);

// ── Venue ───────────────────────────────────────────────────────────────────

export const venueSpaces = pgTable(
  "venue_spaces",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity"),
    /** ceremony | cocktail | dinner | dancefloor | kids | logistics | other */
    usage: text("usage").notNull().default("other"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("venue_spaces_event_idx").on(t.eventId)],
);

/** Which space hosts which moment of the day (optionally linked to a milestone). */
export const venueSpaceAllocations = pgTable(
  "venue_space_allocations",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => venueSpaces.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => eventMilestones.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    startsAt: tsz("starts_at").notNull(),
    endsAt: tsz("ends_at"),
    ...timestamps,
  },
  (t) => [index("venue_space_allocations_event_idx").on(t.eventId, t.startsAt)],
);

/** One logistics sheet per event: technical constraints and installation plan. */
export const venueLogistics = pgTable(
  "venue_logistics",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    electricalNotes: text("electrical_notes"),
    accessNotes: text("access_notes"),
    noiseNotes: text("noise_notes"),
    installationPlan: text("installation_plan"),
    otherConstraints: text("other_constraints"),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("venue_logistics_event_uq").on(t.eventId)],
);

// ── Music ───────────────────────────────────────────────────────────────────

export const musicBriefs = pgTable(
  "music_briefs",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    preferences: text("preferences"),
    forbidden: text("forbidden"),
    /** Free-text indicative playlist (one title per line). */
    playlistText: text("playlist_text"),
    technicalNeeds: text("technical_needs"),
    installationNotes: text("installation_notes"),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("music_briefs_event_uq").on(t.eventId)],
);

/** Key moments with a requested title ("Ouverture de bal — Perfect, Ed Sheeran"). */
export const musicKeyMoments = pgTable(
  "music_key_moments",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    songTitle: text("song_title"),
    artist: text("artist"),
    startsAt: tsz("starts_at"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("music_key_moments_event_idx").on(t.eventId)],
);

// ── Equipment ───────────────────────────────────────────────────────────────

/** Equipment list; each line belongs to a provider member (or the organisers when memberId is null). */
export const equipmentItems = pgTable(
  "equipment_items",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => eventMembers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: smallint("quantity").notNull().default(1),
    /** provider | venue | organizer | rental */
    providedBy: text("provided_by").notNull().default("provider"),
    powerNeeds: text("power_needs"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("equipment_items_event_idx").on(t.eventId)],
);

// ── Images (photo / video) ──────────────────────────────────────────────────

export const imageBriefs = pgTable(
  "image_briefs",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    brief: text("brief"),
    /** Useful contacts on the day (roles + phone), never third-party personal details beyond what the organiser types. */
    usefulContacts: text("useful_contacts"),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("image_briefs_event_uq").on(t.eventId)],
);

/** Shot list: moments to capture, shooting locations. Release consent is tracked per line. */
export const shotListItems = pgTable(
  "shot_list_items",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** moment | location */
    kind: text("kind").notNull().default("moment"),
    title: text("title").notNull(),
    startsAt: tsz("starts_at"),
    location: text("location"),
    notes: text("notes"),
    /** "Autorisation de diffusion recueillie" for the people/group concerned by this line. */
    releaseConsentCollected: boolean("release_consent_collected").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("shot_list_items_event_idx").on(t.eventId)],
);
