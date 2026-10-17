import { relations } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";

export const moderationCaseKindEnum = pgEnum("moderation_case_kind", ["profile_review", "profile_update_review", "report", "review_moderation", "appeal"]);
export const moderationCaseStatusEnum = pgEnum("moderation_case_status", ["open", "in_review", "resolved", "dismissed"]);

/** One case per thing to moderate. Decisions are appended, never edited. */
export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: id(),
    kind: moderationCaseKindEnum("kind").notNull(),
    status: moderationCaseStatusEnum("status").notNull().default("open"),
    resourceType: text("resource_type").notNull(), // professional | profile_version | message | review | user
    resourceId: text("resource_id").notNull(),
    professionalId: uuid("professional_id"),
    openedByUserId: text("opened_by_user_id").references(() => users.id, { onDelete: "set null" }),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    summary: text("summary"),
    resolvedAt: tsz("resolved_at"),
    ...timestamps,
  },
  (t) => [index("moderation_cases_status_idx").on(t.status, t.createdAt), index("moderation_cases_resource_idx").on(t.resourceType, t.resourceId)],
);

export const moderationDecisionEnum = pgEnum("moderation_decision", ["approve", "reject", "request_changes", "suspend", "reinstate", "dismiss", "escalate", "note"]);

export const moderationDecisions = pgTable(
  "moderation_decisions",
  {
    id: id(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => moderationCases.id, { onDelete: "cascade" }),
    decision: moderationDecisionEnum("decision").notNull(),
    reason: text("reason").notNull(),
    decidedByUserId: text("decided_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("moderation_decisions_case_idx").on(t.caseId, t.createdAt)],
);

export const reportReasonEnum = pgEnum("report_reason", ["inappropriate", "fraud", "fake_review", "spam", "safety", "legal", "other"]);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterUserId: text("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    reporterEmail: text("reporter_email"),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    caseId: uuid("case_id").references(() => moderationCases.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("reports_resource_idx").on(t.resourceType, t.resourceId)],
);

export const appeals = pgTable(
  "appeals",
  {
    id: id(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => moderationCases.id, { onDelete: "cascade" }),
    appellantUserId: text("appellant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    argument: text("argument").notNull(),
    status: text("status").$type<"open" | "accepted" | "rejected">().notNull().default("open"),
    decidedByUserId: text("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decisionReason: text("decision_reason"),
    decidedAt: tsz("decided_at"),
    ...timestamps,
  },
  (t) => [index("appeals_case_idx").on(t.caseId)],
);

/** Key/value configuration editable from the back-office (legal variables, retention delays, feature toggles). */
export const configurationSettings = pgTable("configuration_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Editorial pages (legal documents, FAQ...) with variables resolved at render time. */
export const editorialPages = pgTable("editorial_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  /** Markdown-like restricted content (rendered through a safe renderer, no raw HTML). */
  body: text("body").notNull(),
  isPublished: text("is_published").$type<"draft" | "published">().notNull().default("draft"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const moderationCasesRelations = relations(moderationCases, ({ many }) => ({
  decisions: many(moderationDecisions),
  reports: many(reports),
  appeals: many(appeals),
}));
export const moderationDecisionsRelations = relations(moderationDecisions, ({ one }) => ({
  case: one(moderationCases, { fields: [moderationDecisions.caseId], references: [moderationCases.id] }),
  decidedBy: one(users, { fields: [moderationDecisions.decidedByUserId], references: [users.id] }),
}));
export const reportsRelations = relations(reports, ({ one }) => ({
  case: one(moderationCases, { fields: [reports.caseId], references: [moderationCases.id] }),
}));
export const appealsRelations = relations(appeals, ({ one }) => ({
  case: one(moderationCases, { fields: [appeals.caseId], references: [moderationCases.id] }),
}));
