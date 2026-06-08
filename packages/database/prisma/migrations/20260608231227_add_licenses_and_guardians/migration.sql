-- CreateEnum
CREATE TYPE "Product" AS ENUM ('LINKS', 'SOLER', 'SOLS', 'MEDIA_CENTER');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "product_license" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "seats" INTEGER,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_license_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_relationship" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "relation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_license_tenant_id_idx" ON "product_license"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_license_tenant_id_product_key" ON "product_license"("tenant_id", "product");

-- CreateIndex
CREATE INDEX "guardian_relationship_tenant_id_idx" ON "guardian_relationship"("tenant_id");

-- CreateIndex
CREATE INDEX "guardian_relationship_student_id_idx" ON "guardian_relationship"("student_id");

-- CreateIndex
CREATE INDEX "guardian_relationship_guardian_id_idx" ON "guardian_relationship"("guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_relationship_tenant_id_guardian_id_student_id_key" ON "guardian_relationship"("tenant_id", "guardian_id", "student_id");

-- AddForeignKey
ALTER TABLE "product_license" ADD CONSTRAINT "product_license_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationship" ADD CONSTRAINT "guardian_relationship_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationship" ADD CONSTRAINT "guardian_relationship_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationship" ADD CONSTRAINT "guardian_relationship_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
