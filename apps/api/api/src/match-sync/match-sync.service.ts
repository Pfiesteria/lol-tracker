import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RiotService } from '../riot/riot.service';
import type { RiotMatchV5 } from '../riot/riot.service';

type Participant = NonNullable<
  NonNullable<RiotMatchV5['info']>['participants']
>[number];

@Injectable()
export class MatchSyncService {
  constructor(
    private readonly riot: RiotService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  //Gets match data for the account with the given id and saves the match stats to the database currently fetches most recent 5
  async syncRecentMatches(puuid: string, count = 5) {
    const apiKey = this.config.get<string>('RIOT_API_KEY');
    const routing =
      this.config.get<string>('RIOT_REGION_ROUTING') ?? 'americas';

    if (!apiKey) {
      return { error: 'RIOT_API_KEY is not set' };
    }

    const matchIds = await this.riot.getMatchIdsByPuuid(
      puuid,
      routing,
      apiKey,
      0,
      count,
    );

    let createdMatches = 0;
    let updatedMatches = 0;
    let createdParticipants = 0;

    for (const matchId of matchIds) {
      const data = await this.riot.getMatchById(matchId, routing, apiKey);

      const info = data?.info;

      const gameStartMs: number = info?.gameStartTimestamp ?? 0;
      const durationSec: number = info?.gameDuration ?? 0;
      const queueId: number = info?.queueId ?? 0;

      const patch =
        typeof info?.gameVersion === 'string'
          ? info.gameVersion.split('.').slice(0, 2).join('.')
          : null;

      await this.prisma.match.upsert({
        where: { id: matchId },
        create: {
          id: matchId,
          queueId,
          gameStartAt: new Date(gameStartMs),
          durationSec,
          patch: patch ?? undefined,
          raw: data,
        },
        update: {
          queueId,
          gameStartAt: new Date(gameStartMs),
          durationSec,
          patch: patch ?? undefined,
          raw: data,
        },
      });

      // Prisma doesn't tell us whether it was create vs update via upsert,
      // so we infer by checking if it existed beforehand (cheap query).
      const existed = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { createdAt: true },
      });

      if (existed) updatedMatches++;
      else createdMatches++;

      const participants: Participant[] = info?.participants ?? [];

      // Map puuid -> our RiotAccount id (if present). If a participant isn't in our accounts table,
      // we skip inserting them for now (we can widen later).
      const puuids: string[] = participants
        .map((p) => p?.puuid)
        .filter((p): p is string => typeof p === 'string');

      const knownAccounts = await this.prisma.riotAccount.findMany({
        where: { puuid: { in: puuids } },
        select: { id: true, puuid: true },
      });

      const accByPuuid = new Map(knownAccounts.map((a) => [a.puuid, a.id]));

      for (const p of participants) {
        const ppuuid = p?.puuid;
        if (typeof ppuuid !== 'string') continue;

        const riotAccId = accByPuuid.get(ppuuid);
        if (!riotAccId) continue;

        await this.prisma.matchParticipant.upsert({
          where: {
            matchId_riotAccId: {
              matchId,
              riotAccId,
            },
          },
          create: {
            matchId,
            riotAccId,
            championId: Number(p?.championId ?? 0),
            teamId: Number(p?.teamId ?? 0),
            win: Boolean(p?.win ?? false),
            kills: Number(p?.kills ?? 0),
            deaths: Number(p?.deaths ?? 0),
            assists: Number(p?.assists ?? 0),
            lane: typeof p?.lane === 'string' ? p.lane : undefined,
            role: typeof p?.role === 'string' ? p.role : undefined,
          },
          update: {
            championId: Number(p?.championId ?? 0),
            teamId: Number(p?.teamId ?? 0),
            win: Boolean(p?.win ?? false),
            kills: Number(p?.kills ?? 0),
            deaths: Number(p?.deaths ?? 0),
            assists: Number(p?.assists ?? 0),
            lane: typeof p?.lane === 'string' ? p.lane : undefined,
            role: typeof p?.role === 'string' ? p.role : undefined,
          },
        });

        createdParticipants++;
      }
    }

    return {
      puuid,
      matchCountFetched: matchIds.length,
      createdMatches,
      updatedMatches,
      createdParticipants,
    };
  }
}
