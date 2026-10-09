CREATE TABLE "program_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_day_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"position" integer NOT NULL,
	"target_sets" integer NOT NULL,
	"rep_min" integer NOT NULL,
	"rep_max" integer NOT NULL,
	"target_rpe" numeric(3, 1),
	"rest_seconds" integer,
	"notes" text,
	CONSTRAINT "pe_sets_ck" CHECK (target_sets BETWEEN 1 AND 20),
	CONSTRAINT "pe_reps_ck" CHECK (rep_min BETWEEN 1 AND 100 AND rep_max BETWEEN rep_min AND 100),
	CONSTRAINT "pe_rpe_ck" CHECK (target_rpe IS NULL OR (target_rpe BETWEEN 1 AND 10 AND target_rpe * 2 = trunc(target_rpe * 2))),
	CONSTRAINT "pe_rest_ck" CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600)
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "program_day_id" integer;--> statement-breakpoint
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_exercises" ADD CONSTRAINT "program_exercises_program_day_id_program_days_id_fk" FOREIGN KEY ("program_day_id") REFERENCES "public"."program_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_exercises" ADD CONSTRAINT "program_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_days_program_idx" ON "program_days" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "pe_day_idx" ON "program_exercises" USING btree ("program_day_id");--> statement-breakpoint
CREATE INDEX "pe_exercise_idx" ON "program_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_user_name_uq" ON "programs" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_one_active_uq" ON "programs" USING btree ("user_id") WHERE active;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_program_day_id_program_days_id_fk" FOREIGN KEY ("program_day_id") REFERENCES "public"."program_days"("id") ON DELETE set null ON UPDATE no action;