import { relations } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";

export const fileStatusEnum = pgEnum("file_status", ["quarantined", "scanning", "clean", "infected", "rejected", "deleted"]);
export const fileScopeEnum = pgEnum("file_scope", ["user", "professional", "event", "organization", "system"]);

/**
 * Every uploaded file. The storage key is a UUID, never the original name.
 * A file is served only when status = clean, through a signed URL issued after
 * an authorisation check on its scope.
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    uploaderUserId: text("uploader_user_id").references(() => users.id, { onDelete: "set null" }),
    scope: fileScopeEnum("scope").notNull(),
    /** Id of the scope owner: user id, professional id, event id, organization id. */
    scopeId: text("scope_id").notNull(),
    /** Business purpose: avatar | logo | gallery | document | quote | contract | supporting_document | attachment | receipt */
    purpose: text("purpose").notNull(),
    status: fileStatusEnum("status").notNull().default("quarantined"),
    bucket: text("bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    /** Detected from magic bytes, never trusted from the client. */
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** Generated variants: { thumb: key, medium: key, large: key } */
    variants: jsonb("variants").$type<Record<string, { key: string; width: number; height: number; sizeBytes: number }>>().notNull().default({}),
    rejectionReason: text("rejection_reason"),
    downloadCount: integer("download_count").notNull().default(0),
    deletedAt: tsz("deleted_at"),
    ...timestamps,
  },
  (t) => [
    index("files_scope_idx").on(t.scope, t.scopeId),
    index("files_uploader_idx").on(t.uploaderUserId),
    index("files_status_idx").on(t.status),
    // Dedup lookup is restricted to the same scope so hashes never leak across tenants.
    index("files_sha_scope_idx").on(t.sha256, t.scope, t.scopeId),
    uniqueIndex("files_storage_key_uq").on(t.storageKey),
  ],
);

export const fileScanResults = pgTable(
  "file_scan_results",
  {
    id: id(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(), // clamav | policy
    verdict: text("verdict").$type<"clean" | "infected" | "rejected" | "error" | "skipped">().notNull(),
    signature: text("signature"),
    details: text("details"),
    scannedAt: tsz("scanned_at").notNull().defaultNow(),
  },
  (t) => [index("file_scan_results_file_idx").on(t.fileId)],
);

/** Short-lived access grants are not stored: signed URLs expire in minutes. Downloads are logged for sensitive purposes. */
export const fileAccessLogs = pgTable(
  "file_access_logs",
  {
    id: id(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // download | view | denied
    accessedAt: tsz("accessed_at").notNull().defaultNow(),
  },
  (t) => [index("file_access_logs_file_idx").on(t.fileId, t.accessedAt)],
);

// ── GDPR ────────────────────────────────────────────────────────────────────
export const consentRecords = pgTable(
  "consent_records",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Anonymous visitors: cookie consent is keyed by a random id in the consent cookie. */
    anonymousId: text("anonymous_id"),
    /** cookies_analytics | cookies_marketing | marketing_emails | terms | privacy_policy | child_health_data */
    purpose: text("purpose").notNull(),
    granted: text("granted").$type<"granted" | "denied" | "withdrawn">().notNull(),
    /** Version of the policy text accepted. */
    policyVersion: text("policy_version"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("consent_records_user_idx").on(t.userId, t.purpose, t.createdAt), index("consent_records_anon_idx").on(t.anonymousId)],
);

export const dsrKindEnum = pgEnum("dsr_kind", ["access", "rectification", "erasure", "restriction", "portability", "objection"]);
export const dsrStatusEnum = pgEnum("dsr_status", ["received", "in_progress", "completed", "rejected"]);

export const dataSubjectRequests = pgTable(
  "data_subject_requests",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    kind: dsrKindEnum("kind").notNull(),
    status: dsrStatusEnum("status").notNull().default("received"),
    details: text("details"),
    /** Export file produced for access/portability requests. */
    exportFileId: uuid("export_file_id"),
    handledByUserId: text("handled_by_user_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: tsz("due_at").notNull(),
    completedAt: tsz("completed_at"),
    ...timestamps,
  },
  (t) => [index("dsr_status_idx").on(t.status, t.dueAt)],
);

export const retentionJobs = pgTable(
  "retention_jobs",
  {
    id: id(),
    /** children_anonymisation | files_purge | sessions_purge | logs_purge | inactive_accounts */
    policy: text("policy").notNull(),
    status: text("status").$type<"queued" | "running" | "succeeded" | "failed">().notNull().default("queued"),
    affectedCount: integer("affected_count").notNull().default(0),
    error: text("error"),
    startedAt: tsz("started_at"),
    finishedAt: tsz("finished_at"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("retention_jobs_policy_idx").on(t.policy, t.createdAt)],
);

export const filesRelations = relations(files, ({ one, many }) => ({
  uploader: one(users, { fields: [files.uploaderUserId], references: [users.id] }),
  scans: many(fileScanResults),
}));
export const fileScanResultsRelations = relations(fileScanResults, ({ one }) => ({
  file: one(files, { fields: [fileScanResults.fileId], references: [files.id] }),
}));
