CREATE TABLE "letter_verify_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letter_verify_attempts" ADD CONSTRAINT "letter_verify_attempts_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letter_verify_attempts_letter_id_created_at_idx" ON "letter_verify_attempts" USING btree ("letter_id","created_at");