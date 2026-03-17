/*
  Warnings:

  - Added the required column `updatedAt` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MatchIngestStatus" AS ENUM ('PENDING', 'INGESTED', 'FAILED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ingestedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "status" "MatchIngestStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "queueId" DROP NOT NULL,
ALTER COLUMN "gameStartAt" DROP NOT NULL,
ALTER COLUMN "durationSec" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_riotAccId_idx" ON "MatchParticipant"("matchId", "riotAccId");

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_riotAccId_win_idx" ON "MatchParticipant"("matchId", "riotAccId", "win");

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_championId_idx" ON "MatchParticipant"("matchId", "championId");
