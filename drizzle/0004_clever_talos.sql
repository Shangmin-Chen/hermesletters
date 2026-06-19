DROP TABLE "letter_verify_attempts" CASCADE;--> statement-breakpoint
ALTER TABLE "letter_images" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "letters" DROP COLUMN "question";--> statement-breakpoint
ALTER TABLE "letters" DROP COLUMN "answer_normalized";--> statement-breakpoint
ALTER TABLE "letters" DROP COLUMN "answer_shape";