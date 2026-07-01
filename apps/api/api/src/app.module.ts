import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AccountsModule } from './accounts/accounts.module';
import { RiotModule } from './riot/riot.module';
import { MatchSyncModule } from './match-sync/match-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Fail fast at startup if required configuration is missing.
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        RIOT_API_KEY: Joi.string().required(),
        RIOT_REGION_ROUTING: Joi.string().default('americas'),
        PORT: Joi.number().default(3001),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
      }),
    }),
    PrismaModule,
    AccountsModule,
    RiotModule,
    MatchSyncModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
