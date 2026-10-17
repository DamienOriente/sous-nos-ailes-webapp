import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { events } from "./events";
import { professionals } from "./professionals";

export const calendarEntryKindEnum = pgEnum("calendar_entry_kind", ["event", "service", "availability", "unavailability", "reminder", "other"]);

/**
 * Internal calendar. Entries belong to a user (personal agenda) and may be
 * attached to a professional listing and/or an event. All times UTC; `timezone`
 * says how to display and how recurrence is expanded (DST-safe).
 */
export const calendarEntries = pgTable(
  "calendar_entries",
  {
    id: id(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "set null" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    kind: calendarEntryKindEnum("kind").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: tsz("starts_at").notNull(),
    endsAt: tsz("ends_at").notNull(),
    allDay: boolean("all_day").notNull().default(false),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    /** RFC 5545 RRULE without the "RRULE:" prefix, e.g. "FREQ=WEEKLY;BYDAY=SA". */
    rrule: text("rrule"),
    /** Exceptions (ISO dates) excluded from the recurrence. */
    exdates: jsonb("exdates").$type<string[]>().notNull().default([]),
    reminderMinutesBefore: integer("reminder_minutes_before"),
    /** Stable UID for ICS export/import round-trips. */
    icalUid: text("ical_uid").notNull(),
    /** Set when imported from an ICS file or an external connection. */
    sourceConnectionId: uuid("source_connection_id"),
    ...timestamps,
  },
  (t) => [
    index("calendar_entries_owner_time_idx").on(t.ownerUserId, t.startsAt, t.endsAt),
    index("calendar_entries_pro_idx").on(t.professionalId, t.startsAt),
    index("calendar_entries_event_idx").on(t.eventId),
    uniqueIndex("calendar_entries_uid_uq").on(t.ownerUserId, t.icalUid),
  ],
);

export const calendarProviderEnum = pgEnum("calendar_provider", ["google", "microsoft"]);
export const calendarConnectionStatusEnum = pgEnum("calendar_connection_status", ["active", "expired", "revoked", "error"]);

/** OAuth connection to an external calendar. Tokens are encrypted at rest. */
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: calendarProviderEnum("provider").notNull(),
    externalAccountEmail: text("external_account_email"),
    externalCalendarId: text("external_calendar_id"),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    accessTokenExpiresAt: tsz("access_token_expires_at"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    status: calendarConnectionStatusEnum("status").notNull().default("active"),
    /** User-configured direction: export_only | import_only | both */
    syncDirection: text("sync_direction").notNull().default("export_only"),
    /** Provider sync cursor (Google syncToken / Microsoft deltaLink). */
    syncCursor: text("sync_cursor"),
    lastSyncAt: tsz("last_sync_at"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("calendar_connections_uq").on(t.userId, t.provider), index("calendar_connections_status_idx").on(t.status)],
);

/** Mapping internal entry ↔ external event id, with the fingerprint last pushed/pulled to detect conflicts and avoid loops. */
export const calendarSyncMappings = pgTable(
  "calendar_sync_mappings",
  {
    id: id(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => calendarConnections.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => calendarEntries.id, { onDelete: "set null" }),
    externalId: text("external_id").notNull(),
    externalEtag: text("external_etag"),
    /** sha256 of the normalised payload last synchronised. */
    lastSyncedFingerprint: text("last_synced_fingerprint"),
    /** Which side is the source of truth for this mapping (internal | external). */
    origin: text("origin").notNull().default("internal"),
    externalDeletedAt: tsz("external_deleted_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("calendar_sync_mappings_ext_uq").on(t.connectionId, t.externalId), index("calendar_sync_mappings_entry_idx").on(t.entryId)],
);

export const calendarSyncJobs = pgTable(
  "calendar_sync_jobs",
  {
    id: id(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => calendarConnections.id, { onDelete: "cascade" }),
    status: text("status").$type<"queued" | "running" | "succeeded" | "failed">().notNull().default("queued"),
    direction: text("direction").notNull(),
    attempts: integer("attempts").notNull().default(0),
    pushed: integer("pushed").notNull().default(0),
    pulled: integer("pulled").notNull().default(0),
    conflicts: integer("conflicts").notNull().default(0),
    error: text("error"),
    startedAt: tsz("started_at"),
    finishedAt: tsz("finished_at"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("calendar_sync_jobs_connection_idx").on(t.connectionId, t.createdAt)],
);

export const calendarEntriesRelations = relations(calendarEntries, ({ one }) => ({
  owner: one(users, { fields: [calendarEntries.ownerUserId], references: [users.id] }),
  professional: one(professionals, { fields: [calendarEntries.professionalId], references: [professionals.id] }),
  event: one(events, { fields: [calendarEntries.eventId], references: [events.id] }),
}));
export const calendarConnectionsRelations = relations(calendarConnections, ({ one, many }) => ({
  user: one(users, { fields: [calendarConnections.userId], references: [users.id] }),
  mappings: many(calendarSyncMappings),
}));
export const calendarSyncMappingsRelations = relations(calendarSyncMappings, ({ one }) => ({
  connection: one(calendarConnections, { fields: [calendarSyncMappings.connectionId], references: [calendarConnections.id] }),
  entry: one(calendarEntries, { fields: [calendarSyncMappings.entryId], references: [calendarEntries.id] }),
}));
