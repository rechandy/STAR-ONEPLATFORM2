-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "data_collection_session" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "goal_id" TEXT,
    "class_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "domain" "GoalDomain" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "prompt_level" INTEGER,
    "note" TEXT,
    "mastery_target" DOUBLE PRECISION,
    "total_trials" INTEGER NOT NULL DEFAULT 0,
    "correct_trials" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION,
    "goal_mastered" BOOLEAN NOT NULL DEFAULT false,
    "metric_event_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_collection_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "prompt_level" INTEGER,
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_collection_session_tenant_id_idx" ON "data_collection_session"("tenant_id");

-- CreateIndex
CREATE INDEX "data_collection_session_tenant_id_student_id_idx" ON "data_collection_session"("tenant_id", "student_id");

-- CreateIndex
CREATE INDEX "data_collection_session_tenant_id_goal_id_idx" ON "data_collection_session"("tenant_id", "goal_id");

-- CreateIndex
CREATE INDEX "data_collection_session_status_idx" ON "data_collection_session"("status");

-- CreateIndex
CREATE INDEX "trial_tenant_id_idx" ON "trial"("tenant_id");

-- CreateIndex
CREATE INDEX "trial_session_id_idx" ON "trial"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "trial_tenant_id_idempotency_key_key" ON "trial"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "data_collection_session" ADD CONSTRAINT "data_collection_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial" ADD CONSTRAINT "trial_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial" ADD CONSTRAINT "trial_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "data_collection_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
