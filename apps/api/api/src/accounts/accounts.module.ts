import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { RiotModule } from '../riot/riot.module';
import { MatchSyncModule } from '../match-sync/match-sync.module';

//Responsible for handling all account-related operations, such as creating accounts and fetching champion stats for accounts.
//imports RiotModule to interact with the Riot API and the MatchSyncModule to synchronize match data for accounts. The AccountsController defines the endpoints for these operations.
@Module({
  imports: [RiotModule, MatchSyncModule],
  controllers: [AccountsController],
})
export class AccountsModule {}
