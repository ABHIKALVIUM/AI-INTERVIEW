DO $$ BEGIN
 CREATE TYPE "public"."experience_level" AS ENUM('junior', 'mid', 'senior');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."interview_type" AS ENUM('behavioral', 'technical', 'system_design', 'hr');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."session_status" AS ENUM('pending', 'active', 'completed', 'failed', 'abandoned');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."speaker" AS ENUM('ai', 'candidate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "experience_level" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "profiles" ALTER COLUMN "experience_level" SET DATA TYPE experience_level USING experience_level::experience_level;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "interview_type" SET DATA TYPE interview_type USING interview_type::interview_type;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "status" SET DATA TYPE session_status USING status::session_status;--> statement-breakpoint
ALTER TABLE "transcripts" ALTER COLUMN "speaker" SET DATA TYPE speaker USING speaker::speaker;--> statement-breakpoint

ALTER TABLE "profiles" ALTER COLUMN "experience_level" SET DEFAULT 'junior'::experience_level;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'pending'::session_status;