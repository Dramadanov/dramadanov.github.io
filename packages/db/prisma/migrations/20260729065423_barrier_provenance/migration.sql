/*
  Warnings:

  - Added the required column `capturedAt` to the `Barrier` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Barrier" ADD COLUMN     "capturedAt" TIMESTAMP(3) NOT NULL;
