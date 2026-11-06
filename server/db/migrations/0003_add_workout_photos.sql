CREATE TABLE "workout_photos" (
	"workout_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"mime_type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_photos_size_ck" CHECK (octet_length(data) BETWEEN 1 AND 1048576),
	CONSTRAINT "workout_photos_mime_ck" CHECK (mime_type IN ('image/jpeg', 'image/webp'))
);
--> statement-breakpoint
ALTER TABLE "workout_photos" ADD CONSTRAINT "workout_photos_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;