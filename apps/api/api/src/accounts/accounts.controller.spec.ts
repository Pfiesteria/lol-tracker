import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsController } from './accounts.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RiotService } from '../riot/riot.service';
import { MatchSyncService } from '../match-sync/match-sync.service';

describe('AccountsController', () => {
  let controller: AccountsController;
  let prisma: {
    riotAccount: { findUnique: jest.Mock; upsert: jest.Mock };
    matchParticipant: { findMany: jest.Mock; count: jest.Mock };
    match: { findUnique: jest.Mock };
  };
  let config: { get: jest.Mock };
  let matchSync: { syncRecentMatches: jest.Mock };

  beforeEach(async () => {
    prisma = {
      riotAccount: { findUnique: jest.fn(), upsert: jest.fn() },
      matchParticipant: { findMany: jest.fn(), count: jest.fn() },
      match: { findUnique: jest.fn() },
    };
    config = { get: jest.fn() };
    matchSync = { syncRecentMatches: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: RiotService, useValue: {} },
        { provide: MatchSyncService, useValue: matchSync },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('computes win rate and average KDA from participant rows', async () => {
      prisma.riotAccount.findUnique.mockResolvedValue({ id: 'acc1' });
      prisma.matchParticipant.findMany.mockResolvedValue([
        { win: true, kills: 10, deaths: 5, assists: 5 },
        { win: false, kills: 0, deaths: 5, assists: 5 },
      ]);

      const result = await controller.getStats('acc1');

      expect(result.totalGames).toBe(2);
      expect(result.wins).toBe(1);
      expect(result.losses).toBe(1);
      expect(result.winRatePercent).toBe(50);
      expect(result.averages.kills).toBe(5);
      expect(result.averages.deaths).toBe(5);
      expect(result.averages.assists).toBe(5);
      // (avgKills + avgAssists) / avgDeaths = (5 + 5) / 5 = 2
      expect(result.averages.kda).toBe(2);
    });

    it('avoids divide-by-zero when there are no deaths', async () => {
      prisma.riotAccount.findUnique.mockResolvedValue({ id: 'acc1' });
      prisma.matchParticipant.findMany.mockResolvedValue([
        { win: true, kills: 4, deaths: 0, assists: 6 },
      ]);

      const result = await controller.getStats('acc1');

      // With zero deaths, KDA falls back to kills + assists = 10
      expect(result.averages.kda).toBe(10);
    });

    it('throws NotFoundException for a missing account', async () => {
      prisma.riotAccount.findUnique.mockResolvedValue(null);

      await expect(controller.getStats('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createAccount', () => {
    it('throws InternalServerErrorException when the API key is missing', async () => {
      config.get.mockReturnValue(undefined);

      await expect(
        controller.createAccount({
          gameName: 'Name',
          tagLine: 'NA1',
          region: 'americas',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
