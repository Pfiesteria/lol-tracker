import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchIngestStatus } from '@repo/db';
import { PrismaService } from '../prisma/prisma.service';
import { RiotService } from '../riot/riot.service';
import type { RiotMatchV5 } from '../riot/riot.service';

type Participant = NonNullable<
  NonNullable<RiotMatchV5['info']>['participants']
>[number];

@Injectable()
export class MatchSyncService {
  private readonly logger = new Logger(MatchSyncService.name);

  constructor(
    private readonly riot: RiotService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  //Gets match data for the account with the given id and saves the match stats to the database.
  //`start` is the offset into the player's match history (0 = most recent).
  async syncRecentMatches(puuid: string, count = 10, start = 0) {
    const apiKey = this.config.get<string>('RIOT_API_KEY');
    const routing =
      this.config.get<string>('RIOT_REGION_ROUTING') ?? 'americas';

    if (!apiKey) {
      // Env is validated at startup, so this should be unreachable; guard anyway.
      this.logger.error('RIOT_API_KEY is not configured');
      throw new InternalServerErrorException('Server configuration error');
    }

    const matchIds = await this.riot.getMatchIdsByPuuid(
      puuid,
      routing,
      apiKey,
      start,
      count,
    );

    let createdMatches = 0;
    let updatedMatches = 0;
    let failedMatches = 0;
    let participantsProcessed = 0;

    for (const matchId of matchIds) {
      try {
        // Determine create vs update BEFORE the upsert — afterwards the row
        // always exists, so this check has to happen first.
        const existing = await this.prisma.match.findUnique({
          where: { id: matchId },
          select: { id: true },
        });

        const data = await this.riot.getMatchById(matchId, routing, apiKey);

        const info = data?.info;

        const gameStartMs: number = info?.gameStartTimestamp ?? 0;
        const durationSec: number = info?.gameDuration ?? 0;
        const queueId: number = info?.queueId ?? 0;

        const patch =
          typeof info?.gameVersion === 'string'
            ? info.gameVersion.split('.').slice(0, 2).join('.')
            : null;

        const matchFields = {
          queueId,
          gameStartAt: new Date(gameStartMs),
          durationSec,
          patch: patch ?? undefined,
          raw: data,
          status: MatchIngestStatus.INGESTED,
          ingestedAt: new Date(),
          lastError: null,
        };

        await this.prisma.match.upsert({
          where: { id: matchId },
          create: { id: matchId, ...matchFields },
          update: matchFields,
        });

        if (existing) updatedMatches++;
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

          const participantFields = {
            championId: Number(p?.championId ?? 0),
            teamId: Number(p?.teamId ?? 0),
            win: Boolean(p?.win ?? false),
            kills: Number(p?.kills ?? 0),
            deaths: Number(p?.deaths ?? 0),
            assists: Number(p?.assists ?? 0),
            lane: typeof p?.lane === 'string' ? p.lane : undefined,
            role: typeof p?.role === 'string' ? p.role : undefined,
          };

          await this.prisma.matchParticipant.upsert({
            where: { matchId_riotAccId: { matchId, riotAccId } },
            create: { matchId, riotAccId, ...participantFields },
            update: participantFields,
          });

          participantsProcessed++;
        }
      } catch (err) {
        // A single match failing (404, rate limit, malformed data) must not
        // abort the whole sync. Record the failure and move on.
        failedMatches++;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to ingest match ${matchId}: ${message}`);

        await this.prisma.match.upsert({
          where: { id: matchId },
          create: {
            id: matchId,
            status: MatchIngestStatus.FAILED,
            lastError: message,
          },
          update: {
            status: MatchIngestStatus.FAILED,
            lastError: message,
          },
        });
      }
    }

    return {
      puuid,
      matchCountFetched: matchIds.length,
      createdMatches,
      updatedMatches,
      failedMatches,
      participantsProcessed,
    };
  }
}
