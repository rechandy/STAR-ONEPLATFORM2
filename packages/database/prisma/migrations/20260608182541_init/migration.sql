-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('DISTRICT', 'SCHOOL');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'TOBEDELETED');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('DISTRICT_ADMIN', 'ADMINISTRATOR', 'TEACHER', 'SPECIALIST', 'AIDE', 'STUDENT', 'GUARDIAN', 'STAR_STAFF');

-- CreateEnum
CREATE TYPE "ServiceDiscipline" AS ENUM ('SPEECH_LANGUAGE', 'OCCUPATIONAL_THERAPY', 'BEHAVIOR');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('SCHOOL_YEAR', 'SEMESTER', 'TERM', 'GRADING_PERIOD');

-- CreateEnum
CREATE TYPE "GoalDomain" AS ENUM ('ACADEMIC_READINESS', 'BEHAVIOR_SELF_REGULATION', 'COMMUNICATION', 'DAILY_LIVING', 'SOCIAL_SKILLS');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'MET', 'DISCONTINUED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('SIS_ID', 'STATE_ID', 'CLEVER_ID', 'CLASSLINK_ID', 'EMAIL', 'STAR_LEGACY_ID');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('LINKS', 'SOLER', 'SOLS', 'MEDIA', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('TRIAL_SCORE', 'ACCURACY_SNAPSHOT', 'PROMPT_LEVEL_CHANGE', 'OBJECTIVE_MASTERED', 'LESSON_COMPLETED', 'ASSESSMENT_SCORED', 'COURSE_COMPLETED', 'CERTIFICATION_EARNED', 'MEDIA_VIEWED', 'MEDIA_COMPLETED');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "parent_id" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_session" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "SessionType" NOT NULL,
    "school_year" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "parent_id" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "given_name" TEXT NOT NULL,
    "family_name" TEXT NOT NULL,
    "email" TEXT,
    "primary_role" "RoleType" NOT NULL,
    "staff_discipline" "ServiceDiscipline",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identifier" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "user_identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_membership" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "org_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "course_code" TEXT,
    "grades" TEXT[],
    "subject_area" TEXT,
    "org_id" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "class_code" TEXT,
    "class_type" TEXT,
    "focus_domain" "GoalDomain",
    "discipline" "ServiceDiscipline",
    "course_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "begin_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "date_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profile" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "age" INTEGER,
    "date_of_birth" TIMESTAMP(3),
    "primary_diagnosis" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iep_goal" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "authored_by_id" TEXT NOT NULL,
    "class_id" TEXT,
    "domain" "GoalDomain" NOT NULL,
    "description" TEXT NOT NULL,
    "iep_start_date" TIMESTAMP(3) NOT NULL,
    "iep_end_date" TIMESTAMP(3) NOT NULL,
    "days_remaining_to_review" INTEGER,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "goal_met" BOOLEAN NOT NULL DEFAULT false,
    "curriculum_objective_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iep_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_progress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "total_sessions" INTEGER NOT NULL,
    "weeks_in_program" INTEGER NOT NULL,
    "sessions_per_week" DOUBLE PRECISION NOT NULL,
    "baseline_prompt_level" INTEGER NOT NULL,
    "current_prompt_level" INTEGER NOT NULL,
    "prompt_level_change" INTEGER NOT NULL,
    "baseline_accuracy" DOUBLE PRECISION NOT NULL,
    "current_accuracy" DOUBLE PRECISION NOT NULL,
    "accuracy_trend_per_week" DOUBLE PRECISION NOT NULL,
    "consecutive_progress_sessions" INTEGER NOT NULL,
    "goal_met" BOOLEAN NOT NULL,
    "last_evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_event" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "source" "MetricSource" NOT NULL,
    "metric_type" "MetricType" NOT NULL,
    "student_id" TEXT,
    "goal_id" TEXT,
    "class_id" TEXT,
    "recorded_by_id" TEXT,
    "value" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CertificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "ceu_hours" DOUBLE PRECISION,

    CONSTRAINT "certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_engagement" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "metric_type" "MetricType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_engagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "org_tenant_id_idx" ON "org"("tenant_id");

-- CreateIndex
CREATE INDEX "org_tenant_id_type_idx" ON "org"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "org_parent_id_idx" ON "org"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_tenant_id_sourced_id_key" ON "org"("tenant_id", "sourced_id");

-- CreateIndex
CREATE INDEX "academic_session_tenant_id_idx" ON "academic_session"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_session_tenant_id_sourced_id_key" ON "academic_session"("tenant_id", "sourced_id");

-- CreateIndex
CREATE INDEX "app_user_tenant_id_idx" ON "app_user"("tenant_id");

-- CreateIndex
CREATE INDEX "app_user_tenant_id_primary_role_idx" ON "app_user"("tenant_id", "primary_role");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_tenant_id_sourced_id_key" ON "app_user"("tenant_id", "sourced_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_tenant_id_username_key" ON "app_user"("tenant_id", "username");

-- CreateIndex
CREATE INDEX "user_identifier_user_id_idx" ON "user_identifier"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identifier_tenant_id_type_value_key" ON "user_identifier"("tenant_id", "type", "value");

-- CreateIndex
CREATE INDEX "org_membership_tenant_id_idx" ON "org_membership"("tenant_id");

-- CreateIndex
CREATE INDEX "org_membership_org_id_idx" ON "org_membership"("org_id");

-- CreateIndex
CREATE INDEX "org_membership_user_id_idx" ON "org_membership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_membership_tenant_id_user_id_org_id_role_key" ON "org_membership"("tenant_id", "user_id", "org_id", "role");

-- CreateIndex
CREATE INDEX "course_tenant_id_idx" ON "course"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_tenant_id_sourced_id_key" ON "course"("tenant_id", "sourced_id");

-- CreateIndex
CREATE INDEX "class_tenant_id_idx" ON "class"("tenant_id");

-- CreateIndex
CREATE INDEX "class_school_id_idx" ON "class"("school_id");

-- CreateIndex
CREATE INDEX "class_course_id_idx" ON "class"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_tenant_id_sourced_id_key" ON "class"("tenant_id", "sourced_id");

-- CreateIndex
CREATE INDEX "enrollment_tenant_id_idx" ON "enrollment"("tenant_id");

-- CreateIndex
CREATE INDEX "enrollment_class_id_idx" ON "enrollment"("class_id");

-- CreateIndex
CREATE INDEX "enrollment_user_id_idx" ON "enrollment"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_tenant_id_user_id_class_id_role_key" ON "enrollment"("tenant_id", "user_id", "class_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_user_id_key" ON "student_profile"("user_id");

-- CreateIndex
CREATE INDEX "student_profile_tenant_id_idx" ON "student_profile"("tenant_id");

-- CreateIndex
CREATE INDEX "iep_goal_tenant_id_idx" ON "iep_goal"("tenant_id");

-- CreateIndex
CREATE INDEX "iep_goal_student_id_idx" ON "iep_goal"("student_id");

-- CreateIndex
CREATE INDEX "iep_goal_domain_idx" ON "iep_goal"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "iep_goal_tenant_id_sourced_id_key" ON "iep_goal"("tenant_id", "sourced_id");

-- CreateIndex
CREATE UNIQUE INDEX "goal_progress_goal_id_key" ON "goal_progress"("goal_id");

-- CreateIndex
CREATE INDEX "goal_progress_tenant_id_idx" ON "goal_progress"("tenant_id");

-- CreateIndex
CREATE INDEX "metric_event_tenant_id_idx" ON "metric_event"("tenant_id");

-- CreateIndex
CREATE INDEX "metric_event_tenant_id_student_id_idx" ON "metric_event"("tenant_id", "student_id");

-- CreateIndex
CREATE INDEX "metric_event_tenant_id_metric_type_idx" ON "metric_event"("tenant_id", "metric_type");

-- CreateIndex
CREATE INDEX "metric_event_occurred_at_idx" ON "metric_event"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "metric_event_tenant_id_idempotency_key_key" ON "metric_event"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "certification_tenant_id_idx" ON "certification"("tenant_id");

-- CreateIndex
CREATE INDEX "certification_user_id_idx" ON "certification"("user_id");

-- CreateIndex
CREATE INDEX "media_engagement_tenant_id_idx" ON "media_engagement"("tenant_id");

-- CreateIndex
CREATE INDEX "media_engagement_user_id_idx" ON "media_engagement"("user_id");

-- AddForeignKey
ALTER TABLE "org" ADD CONSTRAINT "org_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org" ADD CONSTRAINT "org_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_session" ADD CONSTRAINT "academic_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_session" ADD CONSTRAINT "academic_session_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "academic_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identifier" ADD CONSTRAINT "user_identifier_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_goal" ADD CONSTRAINT "iep_goal_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_goal" ADD CONSTRAINT "iep_goal_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_goal" ADD CONSTRAINT "iep_goal_authored_by_id_fkey" FOREIGN KEY ("authored_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iep_goal" ADD CONSTRAINT "iep_goal_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "iep_goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_event" ADD CONSTRAINT "metric_event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_event" ADD CONSTRAINT "metric_event_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "iep_goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_event" ADD CONSTRAINT "metric_event_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_event" ADD CONSTRAINT "metric_event_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification" ADD CONSTRAINT "certification_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification" ADD CONSTRAINT "certification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_engagement" ADD CONSTRAINT "media_engagement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_engagement" ADD CONSTRAINT "media_engagement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
