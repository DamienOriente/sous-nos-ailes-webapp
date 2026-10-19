import { relations } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, softDelete, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { organizations } from "./organizations";

/**
 * Lifecycle of a professional listing. "published" is the only state visible in
 * the public directory. Demo profiles are flagged and excluded from indexing.
 */
export const professionalStatusEnum = pgEnum("professional_status", [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "published",
  "suspended",
  "rejected",
  "archived",
]);

/** Admin-managed list of trades. `formSchemaKey` drives the conditional onboarding form and `defaultTools` the tool catalogue. */
export const professionalCategories = pgTable(
  "professional_categories",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Grouping for the directory ("Enfants", "Lieux", "Restauration", "Image & son", "Animation", "Beauté", "Logistique"). */
    group: text("group").notNull(),
    icon: text("icon").notNull().default("sparkles"),
    /** Childcare categories get priority in the home page and directory. */
    isChildcare: boolean("is_childcare").notNull().default(false),
    /** Which conditional onboarding form to render (dj, childcare, venue, caterer, photo, animation, generic). */
    formSchemaKey: text("form_schema_key").notNull().default("generic"),
    /** Tool catalogue keys enabled by default for this trade. */
    defaultTools: jsonb("default_tools").$type<string[]>().notNull().default([]),
    /** Suggested template keys for this trade (ordered). */
    suggestedTemplates: jsonb("suggested_templates").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("professional_categories_slug_uq").on(t.slug), index("professional_categories_group_idx").on(t.group)],
);

export const professionals = pgTable(
  "professionals",
  {
    id: id(),
    /** The person operating the listing. Organisation is optional (sole traders). */
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    primaryCategoryId: uuid("primary_category_id")
      .notNull()
      .references(() => professionalCategories.id, { onDelete: "restrict" }),
    status: professionalStatusEnum("status").notNull().default("draft"),
    statusReason: text("status_reason"),
    city: text("city"),
    postalCode: text("postal_code"),
    department: text("department"),
    region: text("region"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    interventionRadiusKm: integer("intervention_radius_km").notNull().default(50),
    priceFromCents: integer("price_from_cents"),
    priceToCents: integer("price_to_cents"),
    priceUnit: text("price_unit"),
    languages: jsonb("languages").$type<string[]>().notNull().default(["fr"]),
    eventTypes: jsonb("event_types").$type<string[]>().notNull().default([]),
    yearsExperience: smallint("years_experience"),
    /** Trade-specific structured answers (validated by the category form schema). */
    tradeDetails: jsonb("trade_details").$type<Record<string, unknown>>().notNull().default({}),
    publicEmail: text("public_email"),
    publicPhone: text("public_phone"),
    website: text("website"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    completenessScore: smallint("completeness_score").notNull().default(0),
    /** Derived from professional_verifications; 0 = nothing verified. */
    verificationLevel: smallint("verification_level").notNull().default(0),
    averageRating: doublePrecision("average_rating"),
    reviewCount: integer("review_count").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    acceptsChildrenServices: boolean("accepts_children_services").notNull().default(false),
    publishedAt: tsz("published_at"),
    /** Set when an agency stops paying for extra listings: hidden from the public, content and status kept. */
    billingHoldAt: tsz("billing_hold_at"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("professionals_slug_uq").on(t.slug),
    index("professionals_owner_idx").on(t.ownerUserId),
    index("professionals_org_idx").on(t.organizationId),
    index("professionals_status_idx").on(t.status),
    index("professionals_category_idx").on(t.primaryCategoryId),
    index("professionals_geo_idx").on(t.department, t.city),
    index("professionals_latlng_idx").on(t.latitude, t.longitude),
  ],
);

export const professionalCategoryAssignments = pgTable(
  "professional_category_assignments",
  {
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => professionalCategories.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("professional_category_assignments_uq").on(t.professionalId, t.categoryId), index("pca_category_idx").on(t.categoryId)],
);

export const professionalServices = pgTable(
  "professional_services",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents"),
    priceUnit: text("price_unit"),
    durationMinutes: integer("duration_minutes"),
    minAge: smallint("min_age"),
    maxAge: smallint("max_age"),
    capacity: integer("capacity"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("professional_services_pro_idx").on(t.professionalId)],
);

/** Each row states precisely what was checked, by whom and when. The public level is derived and never claims more. */
export const verificationKindEnum = pgEnum("verification_kind", [
  "identity_declared",
  "business_registration_checked",
  "documents_reviewed",
  "insurance_declared",
  "insurance_verified",
  "qualification_declared",
  "qualification_verified",
  "administrative_check_done",
]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected", "expired"]);

export const professionalVerifications = pgTable(
  "professional_verifications",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    kind: verificationKindEnum("kind").notNull(),
    status: verificationStatusEnum("status").notNull().default("pending"),
    /** Human-readable statement of what was verified. */
    statement: text("statement"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: tsz("reviewed_at"),
    validUntil: tsz("valid_until"),
    ...timestamps,
  },
  (t) => [index("professional_verifications_pro_idx").on(t.professionalId), uniqueIndex("professional_verifications_uq").on(t.professionalId, t.kind)],
);

export const professionalDocumentKindEnum = pgEnum("professional_document_kind", [
  "kbis_or_sirene",
  "insurance_certificate",
  "qualification",
  "other_supporting",
]);

/** Supporting documents submitted for verification. Only staff with the moderation permission can open them. */
export const professionalDocuments = pgTable(
  "professional_documents",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull(),
    kind: professionalDocumentKindEnum("kind").notNull(),
    label: text("label"),
    status: verificationStatusEnum("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: tsz("reviewed_at"),
    ...timestamps,
  },
  (t) => [index("professional_documents_pro_idx").on(t.professionalId)],
);

/** Weekly availability pattern; explicit unavailable ranges live in calendar_entries. */
export const professionalAvailability = pgTable(
  "professional_availability",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    ...timestamps,
  },
  (t) => [index("professional_availability_pro_idx").on(t.professionalId)],
);

export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "rejected", "hidden"]);

/** Reviews are linked to a verifiable interaction (an inquiry or an event participation). */
export const professionalReviews = pgTable(
  "professional_reviews",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id"),
    inquiryId: uuid("inquiry_id"),
    rating: smallint("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    status: reviewStatusEnum("status").notNull().default("pending"),
    moderationNote: text("moderation_note"),
    replyBody: text("reply_body"),
    repliedAt: tsz("replied_at"),
    /** How the collaboration was proven (2026-10-19): "event" = confirmed provider of the author's event, "inquiry" = confirmed booking. */
    verifiedVia: text("verified_via").$type<"event" | "inquiry">(),
    ...timestamps,
  },
  (t) => [
    index("professional_reviews_pro_idx").on(t.professionalId, t.status),
    uniqueIndex("professional_reviews_author_event_uq").on(t.professionalId, t.authorUserId, t.eventId),
  ],
);

/**
 * A professional recommends partners they work with (2026-10-19). Shown on their public page;
 * "often booked with" is computed separately from confirmed bookings.
 */
export const professionalRecommendations = pgTable(
  "professional_recommendations",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    recommendedProfessionalId: uuid("recommended_professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("professional_recommendations_uq").on(t.professionalId, t.recommendedProfessionalId), index("professional_recommendations_target_idx").on(t.recommendedProfessionalId)],
);

/** Tool catalogue: admin-managed. Entitlement + role + trade decide activation. */
export const toolDefinitions = pgTable("tool_definitions", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** organizer | professional | both */
  audience: text("audience").notNull().default("both"),
  /** Feature flag key required in the plan (null = free). */
  requiredFeature: text("required_feature"),
  /** Category slugs for which this tool is relevant (empty = all). */
  categorySlugs: jsonb("category_slugs").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  ...timestamps,
});

export const professionalToolActivations = pgTable(
  "professional_tool_activations",
  {
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    toolKey: text("tool_key")
      .notNull()
      .references(() => toolDefinitions.key, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    usageCount: integer("usage_count").notNull().default(0),
    lastUsedAt: tsz("last_used_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("professional_tool_activations_uq").on(t.professionalId, t.toolKey)],
);

/** Organiser favourites ("shortlist") on published listings. */
export const professionalFavorites = pgTable(
  "professional_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("professional_favorites_uq").on(t.userId, t.professionalId), index("professional_favorites_pro_idx").on(t.professionalId)],
);

export const professionalsRelations = relations(professionals, ({ one, many }) => ({
  owner: one(users, { fields: [professionals.ownerUserId], references: [users.id] }),
  organization: one(organizations, { fields: [professionals.organizationId], references: [organizations.id] }),
  primaryCategory: one(professionalCategories, { fields: [professionals.primaryCategoryId], references: [professionalCategories.id] }),
  categories: many(professionalCategoryAssignments),
  services: many(professionalServices),
  verifications: many(professionalVerifications),
  documents: many(professionalDocuments),
  availability: many(professionalAvailability),
  reviews: many(professionalReviews),
  favorites: many(professionalFavorites),
}));
export const professionalFavoritesRelations = relations(professionalFavorites, ({ one }) => ({
  professional: one(professionals, { fields: [professionalFavorites.professionalId], references: [professionals.id] }),
  user: one(users, { fields: [professionalFavorites.userId], references: [users.id] }),
}));
export const professionalCategoryAssignmentsRelations = relations(professionalCategoryAssignments, ({ one }) => ({
  professional: one(professionals, { fields: [professionalCategoryAssignments.professionalId], references: [professionals.id] }),
  category: one(professionalCategories, { fields: [professionalCategoryAssignments.categoryId], references: [professionalCategories.id] }),
}));
export const professionalServicesRelations = relations(professionalServices, ({ one }) => ({
  professional: one(professionals, { fields: [professionalServices.professionalId], references: [professionals.id] }),
}));
export const professionalVerificationsRelations = relations(professionalVerifications, ({ one }) => ({
  professional: one(professionals, { fields: [professionalVerifications.professionalId], references: [professionals.id] }),
}));
export const professionalDocumentsRelations = relations(professionalDocuments, ({ one }) => ({
  professional: one(professionals, { fields: [professionalDocuments.professionalId], references: [professionals.id] }),
}));
export const professionalAvailabilityRelations = relations(professionalAvailability, ({ one }) => ({
  professional: one(professionals, { fields: [professionalAvailability.professionalId], references: [professionals.id] }),
}));
export const professionalReviewsRelations = relations(professionalReviews, ({ one }) => ({
  professional: one(professionals, { fields: [professionalReviews.professionalId], references: [professionals.id] }),
  author: one(users, { fields: [professionalReviews.authorUserId], references: [users.id] }),
}));
