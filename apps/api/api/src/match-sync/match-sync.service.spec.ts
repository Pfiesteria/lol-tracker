import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MatchIngestStatus } from '@repo/db';
import { MatchSyncService } from './match-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { RiotService } from '../riot/riot.service';

describe('MatchSyncService', () => {
  let service: MatchSyncService;
  let prisma: {
    match: { findUnique: jest.Mock; upsert: jest.Mock };
    riotAccount: { findMany: jest.Mock };
    matchParticipant: { upsert: jest.Mock };
  };
  let riot: { getMatchIdsByPuuid: jest.Mock; getMatchById: jest.Mock };
  let config: { get: jest.Mock };

  const matchData = {
    info: {
      gameStartTimestamp: 1_700_000_000_000,
      gameDuration: 1800,
      queueId: 420,
      gameVersion: '14.1.1',
      participants: [],
    },
  };

  beforeEach(async () => {
    prisma = {
      match: { findUnique: jest.fn(), upsert: jest.fn().mockResolvedValue({}) },
      riotAccount: { findMany: jest.fn().mockResolvedValue([]) },
      matchParticipant: { upsert: jest.fn().mockResolvedValue({}) },
    };
    riot = {
      getMatchIdsByPuuid: jest.fn().mockResolvedValue(['NA1_1']),
      getMatchById: jest.fn().mockResolvedValue(matchData),
    };
    config = {
      get: jest.fn((key: string) =>
        key === 'RIOT_API_KEY' ? 'test-key' : 'americas',
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<MatchSyncService>(MatchSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('counts a brand-new match as created (existence checked before upsert)', async () => {
    prisma.match.findUnique.mockResolvedValue(null);

    const result = await service.syncRecentMatches('puuid');

    // Existence must be checked before the upsert, otherwise this is always 0.
    expect(prisma.match.findUnique).toHaveBeenCalledTimes(1);
    expect(result.createdMatches).toBe(1);
    expect(result.updatedMatches).toBe(0);
    expect(result.failedMatches).toBe(0);
  });

  it('counts a pre-existing match as updated', async () => {
    prisma.match.findUnique.mockResolvedValue({ id: 'NA1_1' });

    const result = await service.syncRecentMatches('puuid');

    expect(result.createdMatches).toBe(0);
    expect(result.updatedMatches).toBe(1);
  });

  it('marks a match FAILED and continues when Riot fetch throws', async () => {
    prisma.match.findUnique.mockResolvedValue(null);
    riot.getMatchById.mockRejectedValue(new Error('boom'));

    const result = await service.syncRecentMatches('puuid');

    expect(result.failedMatches).toBe(1);
    expect(result.createdMatches).toBe(0);
    // The failure is recorded with FAILED status + lastError.
    const calls = prisma.match.upsert.mock.calls as Array<
      [{ create: { status: MatchIngestStatus; lastError: string } }]
    >;
    const failCall = calls[0][0];
    expect(failCall.create.status).toBe(MatchIngestStatus.FAILED);
    expect(failCall.create.lastError).toBe('boom');
  });
});
