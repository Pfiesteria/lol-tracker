import { Module } from '@nestjs/common';
import { MatchSyncService } from './match-sync.service';
import { RiotModule } from '../riot/riot.module';
import { PrismaModule } from '../prisma/prisma.module';

//The MatchSyncModule is responsible for synchronizing match data for accounts. It imports the RiotModule to interact with the Riot API and the PrismaModule to interact with the database.
// The MatchSyncService defines the logic for synchronizing match data, such as fetching recent matches for an account and saving them to the database.
@Module({
  imports: [RiotModule, PrismaModule],
  providers: [MatchSyncService],
  exports: [MatchSyncService],
})
export class MatchSyncModule {}
