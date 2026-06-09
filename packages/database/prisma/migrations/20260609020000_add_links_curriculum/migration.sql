-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'MASTERED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "lesson" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "steps" JSONB NOT NULL,
    "estimated_minutes" INTEGER,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_assignment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "class_id" TEXT,
    "student_id" TEXT,
    "assigned_by_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "last_accuracy" DOUBLE PRECISION,
    "mastered_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_tenant_id_idx" ON "lesson"("tenant_id");

-- CreateIndex
CREATE INDEX "lesson_objective_id_idx" ON "lesson"("objective_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_tenant_id_code_key" ON "lesson"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "curriculum_assignment_tenant_id_idx" ON "curriculum_assignment"("tenant_id");

-- CreateIndex
CREATE INDEX "curriculum_assignment_tenant_id_student_id_idx" ON "curriculum_assignment"("tenant_id", "student_id");

-- CreateIndex
CREATE INDEX "curriculum_assignment_tenant_id_class_id_idx" ON "curriculum_assignment"("tenant_id", "class_id");

-- CreateIndex
CREATE INDEX "curriculum_assignment_objective_id_idx" ON "curriculum_assignment"("objective_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_assignment_tenant_id_objective_id_class_id_studen_key" ON "curriculum_assignment"("tenant_id", "objective_id", "class_id", "student_id");

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "curriculum_objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignment" ADD CONSTRAINT "curriculum_assignment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignment" ADD CONSTRAINT "curriculum_assignment_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "curriculum_objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignment" ADD CONSTRAINT "curriculum_assignment_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
