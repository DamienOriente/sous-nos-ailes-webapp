import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, softDelete, timestamps, tsz } from "./_shared";
import { users } from "./identity";

export const organizationRoleEnum = pgEnum("organization_role", ["owner", "admin", "manager", "collaborator", "contributor"]);
export const organizationTypeEnum = pgEnum("organization_type", [
  "sole_trader", // micro-entrepreneur / EI
  "company", // SARL, SAS, EURL...
  "association",
  "public_body",
  "other",
]);
/** Agency = structure allowed to run several listings, after a moderator checked it (2026-10-18 decision). */
export const agencyStatusEnum = pgEnum("agency_status", ["none", "pending", "verified", "rejected"]);

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: organizationTypeEnum("type").notNull().default("sole_trader"),
    siren: text("siren"),
    siret: text("siret"),
    vatNumber: text("vat_number"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country").notNull().default("FR"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    agencyStatus: agencyStatusEnum("agency_status").notNull().default("none"),
    agencyRequestedAt: tsz("agency_requested_at"),
    agencyReviewedAt: tsz("agency_reviewed_at"),
    agencyReviewedBy: text("agency_reviewed_by").references(() => users.id, { onDelete: "set null" }),
    agencyReviewNote: text("agency_review_note"),
    /** Listing kept visible when the agency subscription stops (no FK: professionals references this table). */
    primaryListingId: uuid("primary_listing_id"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("organizations_slug_uq").on(t.slug), index("organizations_owner_idx").on(t.ownerUserId), index("organizations_siret_idx").on(t.siret)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull().default("collaborator"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: tsz("accepted_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("organization_members_uq").on(t.organizationId, t.userId), index("organization_members_user_idx").on(t.userId)],
);

/**
 * Pending invitation to join an agency (2026-10-18). The invitee may not have an account
 * yet, so the membership row is only created on acceptance. Only the HMAC of the
 * single-use token is stored.
 */
export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organizationRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: tsz("expires_at").notNull(),
    acceptedAt: tsz("accepted_at"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: tsz("revoked_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("organization_invitations_token_uq").on(t.tokenHash), index("organization_invitations_org_idx").on(t.organizationId, t.email)],
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerUserId], references: [users.id] }),
  members: many(organizationMembers),
}));
export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));
