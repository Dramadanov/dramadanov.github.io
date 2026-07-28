-- CreateEnum
CREATE TYPE "TaxonomyCategory" AS ENUM ('VISUAL', 'AUDITORY', 'MOTOR', 'COGNITIVE', 'SPEECH');

-- CreateEnum
CREATE TYPE "TaxonomySource" AS ENUM ('AGI', 'EXTENDED');

-- CreateEnum
CREATE TYPE "ClaimState" AS ENUM ('PRESENT', 'ABSENT', 'PARTIAL', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('PUBLISHER', 'STOREFRONT', 'REVIEWER', 'COMMUNITY', 'FIRSTPARTY_TEST');

-- CreateEnum
CREATE TYPE "BarrierSeverity" AS ENUM ('HARD', 'SITUATIONAL');

-- CreateEnum
CREATE TYPE "NeedSeverity" AS ENUM ('BLOCKER', 'FRICTION', 'PREFERENCE');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "igdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlatform" (
    "gameId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,

    CONSTRAINT "GamePlatform_pkey" PRIMARY KEY ("gameId","platformId")
);

-- CreateTable
CREATE TABLE "GameAlias" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "GameAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureTaxonomy" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TaxonomyCategory" NOT NULL,
    "source" "TaxonomySource" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureClaim" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "state" "ClaimState" NOT NULL,
    "note" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "trustTier" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barrier" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "severity" "BarrierSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "workaroundRecipeId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Barrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingsRecipe" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "gameVersion" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "staleAt" TIMESTAMP(3) NOT NULL,
    "addressesTaxonomyIds" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettingsRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "menuPath" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "screenshotUrl" TEXT,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "shareSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileNeed" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "severity" "NeedSeverity" NOT NULL,

    CONSTRAINT "ProfileNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_igdbId_key" ON "Game"("igdbId");

-- CreateIndex
CREATE INDEX "Game_name_idx" ON "Game"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE INDEX "GamePlatform_platformId_idx" ON "GamePlatform"("platformId");

-- CreateIndex
CREATE INDEX "GameAlias_gameId_idx" ON "GameAlias"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAlias_scope_value_key" ON "GameAlias"("scope", "value");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureTaxonomy_slug_key" ON "FeatureTaxonomy"("slug");

-- CreateIndex
CREATE INDEX "FeatureTaxonomy_category_idx" ON "FeatureTaxonomy"("category");

-- CreateIndex
CREATE INDEX "FeatureClaim_gameId_platformId_idx" ON "FeatureClaim"("gameId", "platformId");

-- CreateIndex
CREATE INDEX "FeatureClaim_taxonomyId_idx" ON "FeatureClaim"("taxonomyId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureClaim_gameId_platformId_taxonomyId_sourceId_key" ON "FeatureClaim"("gameId", "platformId", "taxonomyId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- CreateIndex
CREATE INDEX "Barrier_gameId_platformId_idx" ON "Barrier"("gameId", "platformId");

-- CreateIndex
CREATE INDEX "Barrier_taxonomyId_idx" ON "Barrier"("taxonomyId");

-- CreateIndex
CREATE INDEX "SettingsRecipe_gameId_platformId_idx" ON "SettingsRecipe"("gameId", "platformId");

-- CreateIndex
CREATE INDEX "SettingsRecipe_staleAt_idx" ON "SettingsRecipe"("staleAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeId_order_key" ON "RecipeStep"("recipeId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_shareSlug_key" ON "Profile"("shareSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileNeed_profileId_taxonomyId_key" ON "ProfileNeed"("profileId", "taxonomyId");

-- AddForeignKey
ALTER TABLE "GamePlatform" ADD CONSTRAINT "GamePlatform_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlatform" ADD CONSTRAINT "GamePlatform_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAlias" ADD CONSTRAINT "GameAlias_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureClaim" ADD CONSTRAINT "FeatureClaim_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureClaim" ADD CONSTRAINT "FeatureClaim_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureClaim" ADD CONSTRAINT "FeatureClaim_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "FeatureTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureClaim" ADD CONSTRAINT "FeatureClaim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "FeatureTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrier" ADD CONSTRAINT "Barrier_workaroundRecipeId_fkey" FOREIGN KEY ("workaroundRecipeId") REFERENCES "SettingsRecipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsRecipe" ADD CONSTRAINT "SettingsRecipe_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsRecipe" ADD CONSTRAINT "SettingsRecipe_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "SettingsRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileNeed" ADD CONSTRAINT "ProfileNeed_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileNeed" ADD CONSTRAINT "ProfileNeed_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "FeatureTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
