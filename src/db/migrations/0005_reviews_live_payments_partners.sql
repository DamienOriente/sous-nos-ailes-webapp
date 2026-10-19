CREATE TYPE "public"."milestone_live_status" AS ENUM('planned', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."payment_item_kind" AS ENUM('deposit', 'balance', 'other');--> statement-breakpoint
CREATE TABLE "professional_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"recommended_professional_id" uuid NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_payment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"budget_line_id" uuid,
	"inquiry_id" uuid,
	"payee_name" text NOT NULL,
	"kind" "payment_item_kind" NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" date,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "professional_reviews" ADD COLUMN "verified_via" text;--> statement-breakpoint
ALTER TABLE "event_milestones" ADD COLUMN "depends_on_milestone_id" uuid;--> statement-breakpoint
ALTER TABLE "event_milestones" ADD COLUMN "delay_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_milestones" ADD COLUMN "delay_reason" text;--> statement-breakpoint
ALTER TABLE "event_milestones" ADD COLUMN "live_status" "milestone_live_status" DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_milestones" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_milestones" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "professional_recommendations" ADD CONSTRAINT "professional_recommendations_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_recommendations" ADD CONSTRAINT "professional_recommendations_recommended_professional_id_professionals_id_fk" FOREIGN KEY ("recommended_professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payment_items" ADD CONSTRAINT "event_payment_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payment_items" ADD CONSTRAINT "event_payment_items_budget_line_id_event_budget_lines_id_fk" FOREIGN KEY ("budget_line_id") REFERENCES "public"."event_budget_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "professional_recommendations_uq" ON "professional_recommendations" USING btree ("professional_id","recommended_professional_id");--> statement-breakpoint
CREATE INDEX "professional_recommendations_target_idx" ON "professional_recommendations" USING btree ("recommended_professional_id");--> statement-breakpoint
CREATE INDEX "event_payment_items_event_idx" ON "event_payment_items" USING btree ("event_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "event_payment_items_quote_uq" ON "event_payment_items" USING btree ("inquiry_id","kind");