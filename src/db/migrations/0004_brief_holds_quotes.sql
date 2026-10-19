CREATE TYPE "public"."professional_hold_status" AS ENUM('active', 'confirmed', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quote_cancellation" AS ENUM('flexible', 'moderate', 'strict', 'custom');--> statement-breakpoint
CREATE TABLE "inquiry_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"balance_due_days" integer,
	"cancellation_policy" "quote_cancellation" DEFAULT 'moderate' NOT NULL,
	"cancellation_terms" text,
	"valid_until" date,
	"note" text,
	"quote_file_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"requester_user_id" text NOT NULL,
	"event_id" uuid,
	"inquiry_id" uuid,
	"hold_date" date NOT NULL,
	"status" "professional_hold_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "style" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "brief_share_budget" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "brief_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "inquiry_quotes" ADD CONSTRAINT "inquiry_quotes_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_quotes" ADD CONSTRAINT "inquiry_quotes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_holds" ADD CONSTRAINT "professional_holds_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_holds" ADD CONSTRAINT "professional_holds_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_holds" ADD CONSTRAINT "professional_holds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_holds" ADD CONSTRAINT "professional_holds_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_holds" ADD CONSTRAINT "professional_holds_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_quotes_version_uq" ON "inquiry_quotes" USING btree ("inquiry_id","version");--> statement-breakpoint
CREATE INDEX "inquiry_quotes_inquiry_idx" ON "inquiry_quotes" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "professional_holds_pro_date_idx" ON "professional_holds" USING btree ("professional_id","hold_date","status");--> statement-breakpoint
CREATE INDEX "professional_holds_requester_idx" ON "professional_holds" USING btree ("requester_user_id","status");