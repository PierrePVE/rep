ALTER TABLE "programs" ADD COLUMN "share_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "programs_share_token_uq" ON "programs" USING btree ("share_token");