-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_rollup" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "total_metrics" INTEGER NOT NULL DEFAULT 0,
    "last_metric_type" TEXT,
    "last_occurred_at" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outcome_rollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_event_status_createdAt_idx" ON "outbox_event"("status", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_event_tenant_id_idx" ON "outbox_event"("tenant_id");

-- CreateIndex
CREATE INDEX "outcome_rollup_tenant_id_idx" ON "outcome_rollup"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "outcome_rollup_tenant_id_student_id_key" ON "outcome_rollup"("tenant_id", "student_id");

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_rollup" ADD CONSTRAINT "outcome_rollup_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
