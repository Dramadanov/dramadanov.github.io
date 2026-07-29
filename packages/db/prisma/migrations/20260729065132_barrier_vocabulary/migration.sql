/*
  Warnings:

  - You are about to drop the column `taxonomyId` on the `Barrier` table. All the data in the column will be lost.
  - Added the required column `barrierTaxonomyId` to the `Barrier` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Barrier" DROP CONSTRAINT "Barrier_taxonomyId_fkey";

-- DropIndex
DROP INDEX "Barrier_taxonomyId_idx";

-- AlterTable
ALTER TABLE "Barrier" DROP COLUMN "taxonomyId",
ADD COLUMN     "barrierTaxonomyId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "BarrierTaxonomy" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TaxonomyCategory" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarrierTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarrierImpact" (
    "barrierTaxonomyId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,

    CONSTRAINT "BarrierImpact_pkey" PRIMARY KEY ("barrierTaxonomyId","taxonomyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarrierTaxonomy_slug_key" ON "BarrierTaxonomy"("slug");

-- CreateIndex
CREATE INDEX "BarrierTaxonomy_category_idx" ON "BarrierTaxonomy"("category");

-- CreateIndex
CREATE INDEX "BarrierImpact_taxonomyId_idx" ON "BarrierImpact"("taxonomyId");

-- CreateIndex
CREATE INDEX "Barrier_barrierTaxonomyId_idx" ON "Barrier"("barrierTaxonomyId");

-- AddForeignKey
ALTER TABLE "BarrierImpact" ADD CONSTRAINT "BarrierImpact_barrierTaxonomyId_fkey" FOREIGN KEY ("barrierTaxonomyId") REFERENCES "BarrierTaxonomy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarrierImpact" ADD CONSTRAINT "BarrierImpact_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "FeatureTaxonomy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_barrierTaxonomyId_fkey" FOREIGN KEY ("barrierTaxonomyId") REFERENCES "BarrierTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
