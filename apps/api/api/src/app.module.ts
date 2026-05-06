import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AccountsModule } from './accounts/accounts.module';
import { RiotService } from './riot/riot.service';
import { RiotModule } from './riot/riot.module';
import { MatchSyncModule } from './match-sync/match-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HttpModule,
    AccountsModule,
    RiotModule,
    MatchSyncModule,
  ],
  controllers: [AppController],
  providers: [RiotService],
})
export class AppModule {}
