ALTER TABLE "letters" ADD COLUMN "public_id" text;--> statement-breakpoint
UPDATE "letters"
SET "public_id" = 'ltr_' || replace("id"::text, '-', '')
WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "letters" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_public_id_unique" UNIQUE("public_id");
