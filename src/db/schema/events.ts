import { relations } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, softDelete, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { organizations } from "./organizations";
import { professionals, professionalCategories } from "./professionals";

export const eventTypeEnum = pgEnum("event_type", [
  "wedding",
  "baptism",
  "birthday",
  "seminar",
  "corporate",
  "family_gathering",
  "other",
]);

export const eventStatusEnum = pgEnum("event_status", ["planning", "confirmed", "in_progress", "completed", "cancelled", "archived"]);

/** Roles within an event. Permissions per role: modules/authorization/domain/event-roles.ts */
export const eventRoleEnum = pgEnum("event_role", [
  "owner",
  "lead_organizer",
  "co_organizer",
  "wedding_planner",
  "provider",
  "collaborator",
  "staff",
  "guest",
]);

export const events = pgTable(
  "events",
  {
    id: id(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    type: eventTypeEnum("type").notNull(),
    description: text("description"),
    status: eventStatusEnum("status").notNull().default("planning"),
    /** Date in the event's timezone; times are optional. */
    eventDate: date("event_date", { mode: "string" }),
    dateIsTentative: boolean("date_is_tentative").notNull().default(false),
    startsAt: tsz("starts_at"),
    endsAt: tsz("ends_at"),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    venueName: text("venue_name"),
    addressLine1: text("address_line1"),
    postalCode: text("postal_code"),
    city: text("city"),
    department: text("department"),
    expectedGuests: integer("expected_guests"),
    expectedChildren: integer("expected_children"),
    budgetCents: integer("budget_cents"),
    preferences: text("preferences"),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("events_owner_idx").on(t.ownerUserId),
    index("events_org_idx").on(t.organizationId),
    index("events_date_idx").on(t.eventDate),
    index("events_status_idx").on(t.status),
  ],
);

export const eventMemberStatusEnum = pgEnum("event_member_status", ["invited", "active", "revoked", "left"]);

export const eventMembers = pgTable(
  "event_members",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: eventRoleEnum("role").notNull(),
    status: eventMemberStatusEnum("status").notNull().default("active"),
    /** For providers: which professional listing they act for (null = personal/external). */
    professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "set null" }),
    /** Trade practised in this event (drives trade tools + default data scope). */
    categoryId: uuid("category_id").references(() => professionalCategories.id, { onDelete: "set null" }),
    title: text("title"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    joinedAt: tsz("joined_at"),
    revokedAt: tsz("revoked_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("event_members_uq").on(t.eventId, t.userId), index("event_members_user_idx").on(t.userId), index("event_members_pro_idx").on(t.professionalId)],
);

/** Explicit grants/denies that refine the role defaults (ABAC overrides). */
export const eventPermissions = pgTable(
  "event_permissions",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(), // e.g. "children.view_sensitive"
    effect: text("effect").$type<"allow" | "deny">().notNull().default("allow"),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: tsz("expires_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("event_permissions_uq").on(t.memberId, t.permission), index("event_permissions_event_idx").on(t.eventId)],
);

export const eventProfessionalStatusEnum = pgEnum("event_professional_status", [
  "shortlisted",
  "requested",
  "quoted",
  "confirmed",
  "declined",
  "cancelled",
]);

/**
 * A provider slot in the event: either a platform professional or an external
 * provider described by the organiser. Never public. Linked to the member row
 * once the professional accepts the secure invitation.
 */
export const eventProfessionals = pgTable(
  "event_professionals",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "set null" }),
    memberId: uuid("member_id").references(() => eventMembers.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => professionalCategories.id, { onDelete: "set null" }),
    /** External provider details (when professionalId is null). */
    externalName: text("external_name"),
    externalEmail: text("external_email"),
    externalPhone: text("external_phone"),
    status: eventProfessionalStatusEnum("status").notNull().default("shortlisted"),
    quoteCents: integer("quote_cents"),
    quoteFileId: uuid("quote_file_id"),
    contractFileId: uuid("contract_file_id"),
    serviceStartsAt: tsz("service_starts_at"),
    serviceEndsAt: tsz("service_ends_at"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("event_professionals_event_idx").on(t.eventId), index("event_professionals_pro_idx").on(t.professionalId)],
);

export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done", "cancelled"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);

export const eventTasks = pgTable(
  "event_tasks",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    /** Checklist section ("Lieu", "Prestataires", "Invités", "Enfants"...). */
    section: text("section"),
    dueDate: date("due_date", { mode: "string" }),
    assigneeMemberId: uuid("assignee_member_id").references(() => eventMembers.id, { onDelete: "set null" }),
    /** Visible to providers (operational) or organisers only. */
    visibility: text("visibility").$type<"organizers" | "team">().notNull().default("organizers"),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: tsz("completed_at"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("event_tasks_event_idx").on(t.eventId, t.status), index("event_tasks_due_idx").on(t.dueDate)],
);

export const eventTaskComments = pgTable(
  "event_task_comments",
  {
    id: id(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => eventTasks.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("event_task_comments_task_idx").on(t.taskId)],
);

/** Timeline of the day ("Cérémonie 15h", "Vin d'honneur 17h"...). */
export const eventMilestones = pgTable(
  "event_milestones",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: tsz("starts_at").notNull(),
    endsAt: tsz("ends_at"),
    location: text("location"),
    /** Which provider categories are concerned (for trade-specific views). */
    categorySlugs: jsonb("category_slugs").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("event_milestones_event_idx").on(t.eventId, t.startsAt)],
);

export const eventBudgetLines = pgTable(
  "event_budget_lines",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // "Lieu", "Traiteur", "Enfants"...
    label: text("label").notNull(),
    plannedCents: integer("planned_cents").notNull().default(0),
    eventProfessionalId: uuid("event_professional_id").references(() => eventProfessionals.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("event_budget_lines_event_idx").on(t.eventId)],
);

export const eventExpenses = pgTable(
  "event_expenses",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    budgetLineId: uuid("budget_line_id").references(() => eventBudgetLines.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<"planned" | "committed" | "paid">().notNull().default("committed"),
    paidAt: date("paid_at", { mode: "string" }),
    receiptFileId: uuid("receipt_file_id"),
    ...timestamps,
  },
  (t) => [index("event_expenses_event_idx").on(t.eventId)],
);

/** Documents attached to an event (contracts, quotes, briefs). Access: organisers + explicitly shared members. */
export const eventDocuments = pgTable(
  "event_documents",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("other"), // contract | quote | brief | plan | other
    /** organizers | team | roles:provider,... — evaluated by authorization. */
    visibility: text("visibility").notNull().default("organizers"),
    eventProfessionalId: uuid("event_professional_id").references(() => eventProfessionals.id, { onDelete: "set null" }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("event_documents_event_idx").on(t.eventId)],
);

/** Checklist templates by event type (admin-editable). */
export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: id(),
    eventType: eventTypeEnum("event_type").notNull(),
    section: text("section").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Days before the event when this should be done (null = no due date). */
    dueDaysBefore: smallint("due_days_before"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("checklist_templates_type_idx").on(t.eventType)],
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  owner: one(users, { fields: [events.ownerUserId], references: [users.id] }),
  members: many(eventMembers),
  professionals: many(eventProfessionals),
  tasks: many(eventTasks),
  milestones: many(eventMilestones),
  budgetLines: many(eventBudgetLines),
  expenses: many(eventExpenses),
  documents: many(eventDocuments),
}));
export const eventMembersRelations = relations(eventMembers, ({ one, many }) => ({
  event: one(events, { fields: [eventMembers.eventId], references: [events.id] }),
  user: one(users, { fields: [eventMembers.userId], references: [users.id] }),
  professional: one(professionals, { fields: [eventMembers.professionalId], references: [professionals.id] }),
  category: one(professionalCategories, { fields: [eventMembers.categoryId], references: [professionalCategories.id] }),
  permissions: many(eventPermissions),
}));
export const eventPermissionsRelations = relations(eventPermissions, ({ one }) => ({
  member: one(eventMembers, { fields: [eventPermissions.memberId], references: [eventMembers.id] }),
}));
export const eventProfessionalsRelations = relations(eventProfessionals, ({ one }) => ({
  event: one(events, { fields: [eventProfessionals.eventId], references: [events.id] }),
  professional: one(professionals, { fields: [eventProfessionals.professionalId], references: [professionals.id] }),
  member: one(eventMembers, { fields: [eventProfessionals.memberId], references: [eventMembers.id] }),
  category: one(professionalCategories, { fields: [eventProfessionals.categoryId], references: [professionalCategories.id] }),
}));
export const eventTasksRelations = relations(eventTasks, ({ one, many }) => ({
  event: one(events, { fields: [eventTasks.eventId], references: [events.id] }),
  assignee: one(eventMembers, { fields: [eventTasks.assigneeMemberId], references: [eventMembers.id] }),
  comments: many(eventTaskComments),
}));
export const eventTaskCommentsRelations = relations(eventTaskComments, ({ one }) => ({
  task: one(eventTasks, { fields: [eventTaskComments.taskId], references: [eventTasks.id] }),
  author: one(users, { fields: [eventTaskComments.authorUserId], references: [users.id] }),
}));
export const eventMilestonesRelations = relations(eventMilestones, ({ one }) => ({
  event: one(events, { fields: [eventMilestones.eventId], references: [events.id] }),
}));
export const eventBudgetLinesRelations = relations(eventBudgetLines, ({ one, many }) => ({
  event: one(events, { fields: [eventBudgetLines.eventId], references: [events.id] }),
  expenses: many(eventExpenses),
}));
export const eventExpensesRelations = relations(eventExpenses, ({ one }) => ({
  event: one(events, { fields: [eventExpenses.eventId], references: [events.id] }),
  budgetLine: one(eventBudgetLines, { fields: [eventExpenses.budgetLineId], references: [eventBudgetLines.id] }),
}));
export const eventDocumentsRelations = relations(eventDocuments, ({ one }) => ({
  event: one(events, { fields: [eventDocuments.eventId], references: [events.id] }),
}));
