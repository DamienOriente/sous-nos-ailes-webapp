import { relations } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { events, eventMembers, eventProfessionals } from "./events";
import { professionals } from "./professionals";

export const channelKindEnum = pgEnum("channel_kind", ["general", "topic", "coordination", "direct"]);

/**
 * Operational channels inside an event. Organisers can read every channel of
 * their event (announced in the UI). Nothing here is a private DM outside an
 * event: those do not exist in V1 by design.
 */
export const eventChannels = pgTable(
  "event_channels",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: channelKindEnum("kind").notNull().default("topic"),
    name: text("name").notNull(),
    description: text("description"),
    /** General channel: every active member; others: explicit membership. */
    isOpenToAllMembers: boolean("is_open_to_all_members").notNull().default(false),
    archivedAt: tsz("archived_at"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("event_channels_event_idx").on(t.eventId)],
);

export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: uuid("channel_id")
      .notNull()
      .references(() => eventChannels.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    lastReadAt: tsz("last_read_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("channel_members_uq").on(t.channelId, t.memberId), index("channel_members_member_idx").on(t.memberId)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => eventChannels.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    /** User ids mentioned with @ — resolved server side from member list. */
    mentions: jsonb("mentions").$type<string[]>().notNull().default([]),
    editedAt: tsz("edited_at"),
    deletedAt: tsz("deleted_at"),
    reportedAt: tsz("reported_at"),
    ...timestamps,
  },
  (t) => [index("messages_channel_idx").on(t.channelId, t.createdAt), index("messages_event_idx").on(t.eventId)],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: id(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull(),
    ...timestamps,
  },
  (t) => [index("message_attachments_message_idx").on(t.messageId)],
);

// ── Commercial inquiries (organiser ↔ professional) ─────────────────────────
export const inquiryKindEnum = pgEnum("inquiry_kind", ["contact", "availability", "quote"]);
export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "new",
  "viewed",
  "info_requested",
  "quoted",
  "accepted",
  "declined",
  "confirmed",
  "archived",
]);

export const inquiries = pgTable(
  "inquiries",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    /** Requester (may be null for a guest inquiry from the public page). */
    requesterUserId: text("requester_user_id").references(() => users.id, { onDelete: "set null" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    eventProfessionalId: uuid("event_professional_id").references(() => eventProfessionals.id, { onDelete: "set null" }),
    kind: inquiryKindEnum("kind").notNull().default("contact"),
    status: inquiryStatusEnum("status").notNull().default("new"),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    requesterPhone: text("requester_phone"),
    eventTypeLabel: text("event_type_label"),
    eventDate: text("event_date"),
    eventCity: text("event_city"),
    guestsCount: integer("guests_count"),
    childrenCount: integer("children_count"),
    message: text("message").notNull(),
    quoteCents: integer("quote_cents"),
    quoteNote: text("quote_note"),
    quoteFileId: uuid("quote_file_id"),
    /** Snapshot of the event brief as sent (what the professional saw), when sent from an event. */
    brief: jsonb("brief").$type<Record<string, unknown>>(),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("inquiries_pro_idx").on(t.professionalId, t.status),
    index("inquiries_requester_idx").on(t.requesterUserId),
    index("inquiries_event_idx").on(t.eventId),
  ],
);

export const inquiryEvents = pgTable(
  "inquiry_events",
  {
    id: id(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: inquiryStatusEnum("from_status"),
    toStatus: inquiryStatusEnum("to_status"),
    note: text("note"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("inquiry_events_inquiry_idx").on(t.inquiryId, t.createdAt)],
);

/**
 * Structured quotes (2026-10-18): every quote sent on an inquiry is a new version, in a common
 * format so organisers can compare providers side by side. The latest version is the current one;
 * `inquiries.quote_cents` mirrors its total for lists.
 */
export const quoteCancellationEnum = pgEnum("quote_cancellation", ["flexible", "moderate", "strict", "custom"]);

export const inquiryQuotes = pgTable(
  "inquiry_quotes",
  {
    id: id(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    totalCents: integer("total_cents").notNull(),
    lineItems: jsonb("line_items").$type<{ label: string; quantity: number; unitCents: number }[]>().notNull().default([]),
    inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),
    exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
    depositCents: integer("deposit_cents").notNull().default(0),
    /** Balance due this many days before the event (0 = on the day). */
    balanceDueDays: integer("balance_due_days"),
    cancellationPolicy: quoteCancellationEnum("cancellation_policy").notNull().default("moderate"),
    cancellationTerms: text("cancellation_terms"),
    validUntil: date("valid_until", { mode: "string" }),
    note: text("note"),
    quoteFileId: uuid("quote_file_id"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("inquiry_quotes_version_uq").on(t.inquiryId, t.version), index("inquiry_quotes_inquiry_idx").on(t.inquiryId)],
);

/**
 * 48-hour option on a professional's date (2026-10-18). Blocks the date for other organisers while
 * active; the professional confirms (the date stays blocked) or releases it; it lapses on its own.
 */
export const professionalHoldStatusEnum = pgEnum("professional_hold_status", ["active", "confirmed", "released", "expired"]);

export const professionalHolds = pgTable(
  "professional_holds",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    inquiryId: uuid("inquiry_id").references(() => inquiries.id, { onDelete: "set null" }),
    holdDate: date("hold_date", { mode: "string" }).notNull(),
    status: professionalHoldStatusEnum("status").notNull().default("active"),
    expiresAt: tsz("expires_at").notNull(),
    resolvedAt: tsz("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("professional_holds_pro_date_idx").on(t.professionalId, t.holdDate, t.status),
    index("professional_holds_requester_idx").on(t.requesterUserId, t.status),
  ],
);

// ── Notifications ───────────────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** invitation_received, invitation_accepted, new_message, inquiry_received, quote_accepted, document_added, deadline, schedule_changed, profile_approved, changes_requested, payment_alert */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    /** Dedup key: same key within the dedup window is not re-created. */
    dedupeKey: text("dedupe_key"),
    eventId: uuid("event_id"),
    readAt: tsz("read_at"),
    emailedAt: tsz("emailed_at"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt), index("notifications_dedupe_idx").on(t.userId, t.dedupeKey)],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  /** immediate | daily | off */
  emailDigest: text("email_digest").notNull().default("immediate"),
  /** Per-type overrides: type → boolean */
  types: jsonb("types").$type<Record<string, boolean>>().notNull().default({}),
  marketingEmails: boolean("marketing_emails").notNull().default(false),
  ...timestamps,
});

/** Outbox for transactional e-mails: retry with backoff, failures logged, never includes health data. */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    templateKey: text("template_key").notNull(),
    /** Template variables (already minimised). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<"pending" | "sent" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: tsz("sent_at"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("email_outbox_status_idx").on(t.status, t.createdAt)],
);

export const eventChannelsRelations = relations(eventChannels, ({ one, many }) => ({
  event: one(events, { fields: [eventChannels.eventId], references: [events.id] }),
  members: many(channelMembers),
  messages: many(messages),
}));
export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(eventChannels, { fields: [channelMembers.channelId], references: [eventChannels.id] }),
  member: one(eventMembers, { fields: [channelMembers.memberId], references: [eventMembers.id] }),
}));
export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(eventChannels, { fields: [messages.channelId], references: [eventChannels.id] }),
  author: one(users, { fields: [messages.authorUserId], references: [users.id] }),
  attachments: many(messageAttachments),
}));
export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, { fields: [messageAttachments.messageId], references: [messages.id] }),
}));
export const inquiriesRelations = relations(inquiries, ({ one, many }) => ({
  professional: one(professionals, { fields: [inquiries.professionalId], references: [professionals.id] }),
  requester: one(users, { fields: [inquiries.requesterUserId], references: [users.id] }),
  event: one(events, { fields: [inquiries.eventId], references: [events.id] }),
  history: many(inquiryEvents),
}));
export const inquiryEventsRelations = relations(inquiryEvents, ({ one }) => ({
  inquiry: one(inquiries, { fields: [inquiryEvents.inquiryId], references: [inquiries.id] }),
}));
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
