CREATE TYPE "public"."letter_status" AS ENUM('unopened', 'opened', 'saved', 'expired');--> statement-breakpoint
CREATE TABLE "letter_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_handle" text NOT NULL,
	"receiver_name" text NOT NULL,
	"letter_name" text NOT NULL,
	"body" text NOT NULL,
	"question" text NOT NULL,
	"answer_normalized" text NOT NULL,
	"answer_shape" text NOT NULL,
	"opened_at" timestamp with time zone,
	"claim_token" uuid,
	"expires_at" timestamp with time zone,
	"saved_by" uuid,
	"saved_at" timestamp with time zone,
	"status" "letter_status" DEFAULT 'unopened' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "letters_url_unique" UNIQUE("sender_handle","receiver_name","letter_name")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "letter_images" ADD CONSTRAINT "letter_images_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_saved_by_profiles_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letter_images_letter_id_idx" ON "letter_images" USING btree ("letter_id");--> statement-breakpoint
CREATE INDEX "letters_saved_by_idx" ON "letters" USING btree ("saved_by");