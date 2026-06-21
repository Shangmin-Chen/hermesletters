CREATE TABLE "letter_verify_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letter_verify_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "open_token_hash" text;--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "secret_prompt" text;--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "secret_answer_hash" text;--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "secret_answer_salt" text;--> statement-breakpoint
ALTER TABLE "letters" ADD COLUMN "secret_answer_shape" text;--> statement-breakpoint
ALTER TABLE "letter_verify_attempts" ADD CONSTRAINT "letter_verify_attempts_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letter_verify_attempts_letter_id_created_at_idx" ON "letter_verify_attempts" USING btree ("letter_id","created_at");
