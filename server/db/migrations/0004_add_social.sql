CREATE TYPE "public"."follow_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."workout_visibility" AS ENUM('followers', 'private');--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" integer NOT NULL,
	"followee_id" integer NOT NULL,
	"status" "follow_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "follows_not_self_ck" CHECK (follower_id <> followee_id)
);
--> statement-breakpoint
CREATE TABLE "workout_likes" (
	"workout_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_likes_workout_id_user_id_pk" PRIMARY KEY("workout_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "visibility" "workout_visibility" DEFAULT 'followers' NOT NULL;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_likes" ADD CONSTRAINT "workout_likes_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_likes" ADD CONSTRAINT "workout_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_ck" CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9_.]{2,19}$');