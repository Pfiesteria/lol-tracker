-- DropForeignKey
ALTER TABLE "MatchParticipant" DROP CONSTRAINT "MatchParticipant_matchId_fkey";

-- DropForeignKey
ALTER TABLE "MatchParticipant" DROP CONSTRAINT "MatchParticipant_riotAccId_fkey";

-- DropIndex
DROP INDEX "MatchParticipant_matchId_idx";

-- DropIndex
DROP INDEX "MatchParticipant_matchId_riotAccId_idx";

-- DropIndex
DROP INDEX "MatchParticipant_matchId_riotAccId_win_idx";

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_riotAccId_fkey" FOREIGN KEY ("riotAccId") REFERENCES "RiotAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
