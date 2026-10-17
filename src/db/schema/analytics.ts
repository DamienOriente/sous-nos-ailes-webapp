import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { id, tsz } from "./_shared";
import { users } from "./identity";

/**
 * Product analytics, first party and minimised. One row per event; `properties`
 * only holds small enumerable values (never free text typed by a user, never
 * health data, never e-mails). Logged-in users: legitimate interest (internal
 * product analytics). Anonymous visitors: only when `cookies_analytics` consent
 * has been granted — the `track()` service enforces it, not the table.
 */
export const productEvents = pgTable(
  "product_events",
  {
    id: id(),
    /** e.g. "user.signed_up", "event.created", "directory.searched" (catalogue in modules/analytics/domain/events.ts). */
    name: text("name").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Random id from the consent cookie; never a fingerprint. */
    anonymousId: text("anonymous_id"),
    properties: jsonb("properties").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("product_events_name_idx").on(t.name, t.createdAt), index("product_events_user_idx").on(t.userId, t.createdAt)],
);
