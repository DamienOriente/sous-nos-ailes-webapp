import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { professionals } from "./professionals";

/**
 * Public page of a professional. Content is a versioned, validated block tree
 * (see modules/pages/domain/page-schema.ts). Templates are code-defined; the DB
 * stores the template key + the schema version so templates can evolve without
 * touching existing pages.
 */
export const publicProfiles = pgTable(
  "public_profiles",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    /** Version currently visible to the public (approved), null while never published. */
    publishedVersionId: uuid("published_version_id"),
    /** Version being edited (always exists after creation). */
    draftVersionId: uuid("draft_version_id"),
    slug: text("slug").notNull(),
    isIndexable: boolean("is_indexable").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("public_profiles_pro_uq").on(t.professionalId), uniqueIndex("public_profiles_slug_uq").on(t.slug)],
);

export const profileVersionStatusEnum = pgEnum("profile_version_status", ["draft", "submitted", "approved", "rejected", "superseded"]);

export const profileVersions = pgTable(
  "profile_versions",
  {
    id: id(),
    publicProfileId: uuid("public_profile_id")
      .notNull()
      .references(() => publicProfiles.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: profileVersionStatusEnum("status").notNull().default("draft"),
    templateKey: text("template_key").notNull(),
    schemaVersion: smallint("schema_version").notNull().default(1),
    /** Theme overrides: palette key, accent colour, font pairing, radius. Validated. */
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull().default({}),
    /** Ordered, validated block tree. Never raw HTML. */
    content: jsonb("content").$type<unknown>().notNull().default([]),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    submittedAt: tsz("submitted_at"),
    reviewedAt: tsz("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("profile_versions_uq").on(t.publicProfileId, t.versionNumber), index("profile_versions_status_idx").on(t.status)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull(),
    kind: text("kind").notNull().default("gallery"), // logo | cover | gallery
    alt: text("alt").notNull().default(""),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("media_assets_pro_idx").on(t.professionalId)],
);

export const publicProfilesRelations = relations(publicProfiles, ({ one, many }) => ({
  professional: one(professionals, { fields: [publicProfiles.professionalId], references: [professionals.id] }),
  versions: many(profileVersions),
}));
export const profileVersionsRelations = relations(profileVersions, ({ one }) => ({
  profile: one(publicProfiles, { fields: [profileVersions.publicProfileId], references: [publicProfiles.id] }),
}));
