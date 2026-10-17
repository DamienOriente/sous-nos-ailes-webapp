import { relations } from "drizzle-orm";
import { boolean, index, inet, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";

/** Global platform roles. Business roles (organizer, professional) are contextual, never global. */
export const globalRoleEnum = pgEnum("global_role", ["user", "moderator", "admin", "super_admin"]);

// ── better-auth core tables ──────────────────────────────────────────────────
// Column names follow better-auth's defaults so the drizzle adapter maps 1:1.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // admin plugin
    role: text("role").notNull().default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: tsz("ban_expires"),
    // two-factor plugin
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    // app fields
    locale: text("locale").notNull().default("fr"),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    isDemo: boolean("is_demo").notNull().default(false),
    lastLoginAt: tsz("last_login_at"),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: tsz("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.token), index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: tsz("access_token_expires_at"),
    refreshTokenExpiresAt: tsz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tsz("expires_at").notNull(),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(false),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: tsz("locked_until"),
  },
  (t) => [index("two_factors_user_idx").on(t.userId)],
);

// ── Application profile (1:1 with users) ────────────────────────────────────
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone"),
  city: text("city"),
  postalCode: text("postal_code"),
  /** Intent chosen at signup; never restricts what the account can do. */
  primaryIntent: text("primary_intent").$type<"organizer" | "professional">(),
  onboardingCompletedAt: tsz("onboarding_completed_at"),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  ...timestamps,
});

// ── Audit & security ────────────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /** e.g. "event.member.role_changed", "professional.approved" */
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    /** Scope for isolation queries: event / organization / professional id. */
    eventId: uuid("event_id"),
    organizationId: uuid("organization_id"),
    /** Never contains secrets, health data or document contents. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    reason: text("reason"),
    ipAddress: inet("ip_address"),
    requestId: text("request_id"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_logs_resource_idx").on(t.resourceType, t.resourceId),
    index("audit_logs_event_idx").on(t.eventId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const securityEventSeverityEnum = pgEnum("security_event_severity", ["info", "low", "medium", "high", "critical"]);

export const securityEvents = pgTable(
  "security_events",
  {
    id: id(),
    type: text("type").notNull(), // login_failed, rate_limited, forbidden_access, webhook_signature_invalid, upload_rejected...
    severity: securityEventSeverityEnum("severity").notNull().default("info"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("security_events_type_idx").on(t.type, t.createdAt), index("security_events_user_idx").on(t.userId)],
);

/** Login attempt counters kept in DB as a fallback when Redis is unavailable. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    key: text("key").primaryKey(), // email or ip
    count: integer("count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: tsz("updated_at").notNull().defaultNow(),
  },
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  sessions: many(sessions),
  accounts: many(accounts),
}));
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));
