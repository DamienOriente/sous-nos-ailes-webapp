CREATE TYPE "public"."agency_status" AS ENUM('none', 'pending', 'verified', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."plan_audience" ADD VALUE 'agency';--> statement-breakpoint
ALTER TYPE "public"."moderation_case_kind" ADD VALUE 'agency_review';--> statement-breakpoint
CREATE TABLE "plan_price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"up_to" integer,
	"unit_amount_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "agency_status" "agency_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "agency_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "agency_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "agency_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "agency_review_note" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "primary_listing_id" uuid;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "billing_hold_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_price_tiers" ADD CONSTRAINT "plan_price_tiers_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_price_tiers_uq" ON "plan_price_tiers" USING btree ("plan_id","up_to");--> statement-breakpoint
CREATE INDEX "plan_price_tiers_plan_idx" ON "plan_price_tiers" USING btree ("plan_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_agency_reviewed_by_users_id_fk" FOREIGN KEY ("agency_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("organization_id");