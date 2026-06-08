-- CreateTable
CREATE TABLE "curriculum_objective" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sourced_id" TEXT NOT NULL,
    "domain" "GoalDomain" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "course_id" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_objective_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curriculum_objective_tenant_id_idx" ON "curriculum_objective"("tenant_id");

-- CreateIndex
CREATE INDEX "curriculum_objective_domain_idx" ON "curriculum_objective"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_objective_tenant_id_sourced_id_key" ON "curriculum_objective"("tenant_id", "sourced_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_objective_tenant_id_code_key" ON "curriculum_objective"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "iep_goal_curriculum_objective_id_idx" ON "iep_goal"("curriculum_objective_id");

-- AddForeignKey
ALTER TABLE "iep_goal" ADD CONSTRAINT "iep_goal_curriculum_objective_id_fkey" FOREIGN KEY ("curriculum_objective_id") REFERENCES "curriculum_objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_objective" ADD CONSTRAINT "curriculum_objective_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_objective" ADD CONSTRAINT "curriculum_objective_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
