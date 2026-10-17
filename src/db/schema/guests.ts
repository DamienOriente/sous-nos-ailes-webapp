import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, real, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { organizations } from "./organizations";
import { events } from "./events";

/** Private address book. Scoped to a user or an organisation; never platform-wide. */
export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    category: text("category"), // client | provider | partner | family | other
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    /** Normalised key used for duplicate detection (lower(email) or phone digits). */
    dedupeKey: text("dedupe_key"),
    linkedUserId: text("linked_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("contacts_owner_idx").on(t.ownerUserId),
    index("contacts_org_idx").on(t.organizationId),
    index("contacts_dedupe_idx").on(t.ownerUserId, t.dedupeKey),
  ],
);

export const contactEventLinks = pgTable(
  "contact_event_links",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("contact_event_links_uq").on(t.contactId, t.eventId)],
);

export const guestGroups = pgTable(
  "guest_groups",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Famille Martin", "Collègues"
    side: text("side"), // "mariée" | "marié" | null
    ...timestamps,
  },
  (t) => [index("guest_groups_event_idx").on(t.eventId)],
);

export const rsvpStatusEnum = pgEnum("rsvp_status", ["pending", "accepted", "declined", "maybe"]);

export const eventGuests = pgTable(
  "event_guests",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => guestGroups.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    isChild: boolean("is_child").notNull().default(false),
    ageYears: smallint("age_years"),
    /** Dietary count only (vegetarian, no-pork...). Medical details never live here. */
    dietaryPreference: text("dietary_preference"),
    plusOnesAllowed: smallint("plus_ones_allowed").notNull().default(0),
    rsvpStatus: rsvpStatusEnum("rsvp_status").notNull().default("pending"),
    rsvpAnsweredAt: tsz("rsvp_answered_at"),
    rsvpGuestsCount: smallint("rsvp_guests_count"),
    rsvpMessage: text("rsvp_message"),
    notes: text("notes"),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("event_guests_event_idx").on(t.eventId), index("event_guests_group_idx").on(t.groupId)],
);

export const invitationKindEnum = pgEnum("invitation_kind", ["individual", "family", "group", "provider"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["draft", "sent", "viewed", "answered", "revoked", "expired"]);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: invitationKindEnum("kind").notNull().default("individual"),
    templateKey: text("template_key").notNull().default("classic"),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email"),
    customMessage: text("custom_message"),
    /** Organiser choices for the printed/public card (what to reveal). */
    displayOptions: jsonb("display_options").$type<{ showDate: boolean; showVenue: boolean }>().notNull().default({ showDate: true, showVenue: true }),
    status: invitationStatusEnum("status").notNull().default("draft"),
    /** Guests covered by this invitation (for family/group invitations). */
    guestIds: jsonb("guest_ids").$type<string[]>().notNull().default([]),
    /** For provider invitations: which event_professionals slot and target member role. */
    eventProfessionalId: uuid("event_professional_id"),
    targetRole: text("target_role"),
    sentAt: tsz("sent_at"),
    viewedAt: tsz("viewed_at"),
    answeredAt: tsz("answered_at"),
    reminderCount: smallint("reminder_count").notNull().default(0),
    lastReminderAt: tsz("last_reminder_at"),
    expiresAt: tsz("expires_at"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("invitations_event_idx").on(t.eventId, t.status)],
);

/**
 * Secure tokens for invitation links and QR codes. Lookups use the HMAC of the
 * token; an encrypted copy allows re-rendering the QR/link for the organiser.
 * A QR code encodes the opaque token only — never personal data — and is
 * validated server side.
 */
export const invitationTokens = pgTable(
  "invitation_tokens",
  {
    id: id(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /**
     * AES-256-GCM copy of the clear token (lib/crypto encryptText) so the QR code
     * and the RSVP link can be re-rendered for the organiser (print, PDF, copy
     * link). Lookups always go through tokenHash; this column is never indexed.
     */
    tokenEncrypted: text("token_encrypted"),
    purpose: text("purpose").$type<"rsvp" | "checkin" | "provider_join">().notNull(),
    expiresAt: tsz("expires_at"),
    revokedAt: tsz("revoked_at"),
    usedAt: tsz("used_at"),
    maxUses: smallint("max_uses").notNull().default(1),
    useCount: smallint("use_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("invitation_tokens_hash_uq").on(t.tokenHash), index("invitation_tokens_invitation_idx").on(t.invitationId)],
);

export const invitationResponses = pgTable(
  "invitation_responses",
  {
    id: id(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    status: rsvpStatusEnum("status").notNull(),
    guestsCount: smallint("guests_count").notNull().default(1),
    message: text("message"),
    /** Per-guest answers (guestId → accepted/declined) for family invitations. */
    perGuest: jsonb("per_guest").$type<Record<string, "accepted" | "declined">>().notNull().default({}),
    ipAddress: text("ip_address"),
    ...timestamps,
  },
  (t) => [index("invitation_responses_invitation_idx").on(t.invitationId)],
);

export const checkinResultEnum = pgEnum("checkin_result", ["accepted", "duplicate", "revoked", "expired", "invalid"]);

export const invitationCheckins = pgTable(
  "invitation_checkins",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    invitationId: uuid("invitation_id").references(() => invitations.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id").references(() => invitationTokens.id, { onDelete: "set null" }),
    result: checkinResultEnum("result").notNull(),
    scannedByUserId: text("scanned_by_user_id").references(() => users.id, { onDelete: "set null" }),
    scannedAt: tsz("scanned_at").notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [index("invitation_checkins_event_idx").on(t.eventId, t.scannedAt)],
);

// ── Seating plan ────────────────────────────────────────────────────────────
export const seatingTables = pgTable(
  "seating_tables",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shape: text("shape").$type<"round" | "rectangle" | "square" | "oval">().notNull().default("round"),
    capacity: smallint("capacity").notNull().default(8),
    /** Position on a normalised 1000x700 canvas. */
    x: real("x").notNull().default(100),
    y: real("y").notNull().default(100),
    rotation: real("rotation").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("seating_tables_event_idx").on(t.eventId)],
);

export const seatingAssignments = pgTable(
  "seating_assignments",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => seatingTables.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => eventGuests.id, { onDelete: "cascade" }),
    seatNumber: smallint("seat_number"),
    ...timestamps,
  },
  (t) => [uniqueIndex("seating_assignments_guest_uq").on(t.guestId), index("seating_assignments_table_idx").on(t.tableId)],
);

export const contactsRelations = relations(contacts, ({ one }) => ({
  owner: one(users, { fields: [contacts.ownerUserId], references: [users.id] }),
}));
export const eventGuestsRelations = relations(eventGuests, ({ one }) => ({
  event: one(events, { fields: [eventGuests.eventId], references: [events.id] }),
  group: one(guestGroups, { fields: [eventGuests.groupId], references: [guestGroups.id] }),
}));
export const guestGroupsRelations = relations(guestGroups, ({ one, many }) => ({
  event: one(events, { fields: [guestGroups.eventId], references: [events.id] }),
  guests: many(eventGuests),
}));
export const invitationsRelations = relations(invitations, ({ one, many }) => ({
  event: one(events, { fields: [invitations.eventId], references: [events.id] }),
  tokens: many(invitationTokens),
  responses: many(invitationResponses),
}));
export const invitationTokensRelations = relations(invitationTokens, ({ one }) => ({
  invitation: one(invitations, { fields: [invitationTokens.invitationId], references: [invitations.id] }),
}));
export const invitationResponsesRelations = relations(invitationResponses, ({ one }) => ({
  invitation: one(invitations, { fields: [invitationResponses.invitationId], references: [invitations.id] }),
}));
export const seatingTablesRelations = relations(seatingTables, ({ one, many }) => ({
  event: one(events, { fields: [seatingTables.eventId], references: [events.id] }),
  assignments: many(seatingAssignments),
}));
export const seatingAssignmentsRelations = relations(seatingAssignments, ({ one }) => ({
  table: one(seatingTables, { fields: [seatingAssignments.tableId], references: [seatingTables.id] }),
  guest: one(eventGuests, { fields: [seatingAssignments.guestId], references: [eventGuests.id] }),
}));

