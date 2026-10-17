import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { professionals } from "./professionals";

/**
 * Plans are admin-configurable. Prices are commercial hypotheses until the
 * owner validates them; nothing here is charged for real until Stripe live keys
 * are configured and the legal checklist is complete.
 */
export const planAudienceEnum = pgEnum("plan_audience", ["organizer", "professional"]);

export const plans = pgTable(
  "plans",
  {
    id: id(),
    key: text("key").notNull(), // organizer_free, organizer_plus, professional_free, professional_premium
    name: text("name").notNull(),
    audience: planAudienceEnum("audience").notNull(),
    description: text("description").notNull().default(""),
    priceMonthlyCents: integer("price_monthly_cents").notNull().default(0),
    currency: text("currency").notNull().default("EUR"),
    /** Stripe price id (test or live depending on the configured key). */
    stripePriceId: text("stripe_price_id"),
    stripeProductId: text("stripe_product_id"),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("plans_key_uq").on(t.key)],
);

/** Feature flags per plan, with optional numeric limits (e.g. contacts.max = 50). */
export const planFeatures = pgTable(
  "plan_features",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    limitValue: integer("limit_value"),
  },
  (t) => [uniqueIndex("plan_features_uq").on(t.planId, t.featureKey)],
);

export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    email: text("email"),
    ...timestamps,
  },
  (t) => [uniqueIndex("billing_customers_user_uq").on(t.userId), uniqueIndex("billing_customers_stripe_uq").on(t.stripeCustomerId)],
);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

/**
 * One subscription per (user, audience). Organizer plan applies to the user
 * account; professional plan applies to a listing.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "set null" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    /** mock | stripe — mock only exists when Stripe keys are absent (local). */
    provider: text("provider").notNull().default("stripe"),
    currentPeriodStart: tsz("current_period_start"),
    currentPeriodEnd: tsz("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: tsz("canceled_at"),
    endedAt: tsz("ended_at"),
    ...timestamps,
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId, t.status),
    uniqueIndex("subscriptions_stripe_uq").on(t.stripeSubscriptionId),
    index("subscriptions_pro_idx").on(t.professionalId),
  ],
);

/** Idempotent webhook ledger: every Stripe event id is processed at most once. */
export const billingEvents = pgTable(
  "billing_events",
  {
    id: id(),
    provider: text("provider").notNull().default("stripe"),
    externalEventId: text("external_event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    processedAt: tsz("processed_at"),
    error: text("error"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("billing_events_external_uq").on(t.provider, t.externalEventId), index("billing_events_type_idx").on(t.type, t.createdAt)],
);

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: id(),
    code: text("code").notNull(),
    description: text("description"),
    percentOff: integer("percent_off"),
    amountOffCents: integer("amount_off_cents"),
    durationMonths: integer("duration_months"),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    stripeCouponId: text("stripe_coupon_id"),
    validFrom: tsz("valid_from"),
    validUntil: tsz("valid_until"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("promo_codes_code_uq").on(t.code)],
);

/** Sponsored placements: clearly labelled, limited per zone/category, never bypass moderation. */
export const featuredPlacements = pgTable(
  "featured_placements",
  {
    id: id(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    categorySlug: text("category_slug"),
    department: text("department"),
    startsAt: tsz("starts_at").notNull(),
    endsAt: tsz("ends_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("featured_placements_lookup_idx").on(t.categorySlug, t.department, t.startsAt, t.endsAt)],
);

export const plansRelations = relations(plans, ({ many }) => ({ features: many(planFeatures), subscriptions: many(subscriptions) }));
export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({ plan: one(plans, { fields: [planFeatures.planId], references: [plans.id] }) }));
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  professional: one(professionals, { fields: [subscriptions.professionalId], references: [professionals.id] }),
}));
