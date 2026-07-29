-- AlterTable
ALTER TABLE "Barrier" ADD COLUMN     "archiveUrl" TEXT,
ADD COLUMN     "contentHash" TEXT;

-- AlterTable
ALTER TABLE "BarrierTaxonomy" ADD COLUMN     "archiveUrl" TEXT,
ADD COLUMN     "contentHash" TEXT;

-- AlterTable
ALTER TABLE "FeatureClaim" ADD COLUMN     "archiveUrl" TEXT,
ADD COLUMN     "contentHash" TEXT;

-- AlterTable
ALTER TABLE "FeatureTaxonomy" ADD COLUMN     "archiveUrl" TEXT,
ADD COLUMN     "contentHash" TEXT;
