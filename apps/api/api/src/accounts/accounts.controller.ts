import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Param,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { RiotService } from '../riot/riot.service';
import { MatchSyncService } from '../match-sync/match-sync.service';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(
    private readonly riot: RiotService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly matchSync: MatchSyncService,
  ) {}

  private requireApiKey(): string {
    const apiKey = this.config.get<string>('RIOT_API_KEY');
    if (!apiKey) {
      // Don't leak configuration details to clients; log server-side instead.
      this.logger.error('RIOT_API_KEY is not configured');
      throw new InternalServerErrorException('Server configuration error');
    }
    return apiKey;
  }

  @Post()
  @ApiBody({ type: CreateAccountDto })
  async createAccount(@Body() body: CreateAccountDto) {
    const apiKey = this.requireApiKey();

    const account = await this.riot.getAccountByRiotId(
      body.gameName,
      body.tagLine,
      body.region,
      apiKey,
    );

    // Persist the account, updating the existing record if it already exists.
    const saved = await this.prisma.riotAccount.upsert({
      where: { puuid: account.puuid },
      create: {
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine,
        region: body.region,
      },
      update: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        region: body.region,
      },
    });

    // Load the most recent matches as soon as an account is looked up.
    await this.matchSync.syncRecentMatches(saved.puuid, 10);

    return saved;
  }

  @Post(':id/sync')
  async syncAccount(@Param('id') id: string) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
    });

    if (!account) throw new NotFoundException('Account not found');

    return this.matchSync.syncRecentMatches(account.puuid, 10);
  }

  @Get(':id')
  async getAccount(@Param('id') id: string) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
      select: {
        id: true,
        puuid: true,
        gameName: true,
        tagLine: true,
        region: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!account) throw new NotFoundException('Account not found');

    return account;
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) throw new NotFoundException('Account not found');

    const rows = await this.prisma.matchParticipant.findMany({
      where: { riotAccId: id },
      select: { win: true, kills: true, deaths: true, assists: true },
    });

    const totalGames = rows.length;
    const wins = rows.filter((r) => r.win).length;
    const losses = totalGames - wins;

    const kills = rows.reduce((sum, r) => sum + r.kills, 0);
    const deaths = rows.reduce((sum, r) => sum + r.deaths, 0);
    const assists = rows.reduce((sum, r) => sum + r.assists, 0);

    const avgKills = totalGames ? kills / totalGames : 0;
    const avgDeaths = totalGames ? deaths / totalGames : 0;
    const avgAssists = totalGames ? assists / totalGames : 0;

    const winRate = totalGames ? wins / totalGames : 0;

    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      accountId: id,
      totalGames,
      wins,
      losses,
      winRatePercent: totalGames ? round(winRate * 100) : 0,
      averages: {
        kills: round(avgKills),
        deaths: round(avgDeaths),
        assists: round(avgAssists),
        kda: round(
          avgDeaths === 0
            ? avgKills + avgAssists
            : (avgKills + avgAssists) / avgDeaths,
        ),
      },
    };
  }

  @Get(':id/champions')
  async getChampionStats(@Param('id') id: string) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) throw new NotFoundException('Account not found');

    const rows = await this.prisma.matchParticipant.findMany({
      where: { riotAccId: id },
      select: { championId: true, win: true },
    });

    const byChamp = new Map<number, { games: number; wins: number }>();

    for (const r of rows) {
      const cur = byChamp.get(r.championId) ?? { games: 0, wins: 0 };
      cur.games += 1;
      if (r.win) cur.wins += 1;
      byChamp.set(r.championId, cur);
    }
    const results = Array.from(byChamp.entries())
      .map(([championId, v]) => ({
        championId,
        games: v.games,
        wins: v.wins,
        losses: v.games - v.wins,
        winRatePercent: v.games
          ? Math.round((v.wins / v.games) * 10000) / 100
          : 0,
      }))
      .sort((a, b) => b.games - a.games);

    return {
      accountId: id,
      champions: results,
    };
  }

  // Reads a page of an account's matches from the database, newest first.
  private async readMatchesPage(id: string, take: number, skip: number) {
    const rows = await this.prisma.matchParticipant.findMany({
      where: { riotAccId: id },
      select: {
        matchId: true,
        championId: true,
        win: true,
        kills: true,
        deaths: true,
        assists: true,
        lane: true,
        role: true,
        match: {
          select: {
            queueId: true,
            gameStartAt: true,
            durationSec: true,
            patch: true,
          },
        },
      },
      orderBy: {
        match: {
          gameStartAt: 'desc',
        },
      },
      take,
      skip,
    });

    return rows.map((r) => ({
      matchId: r.matchId,
      championId: r.championId,
      win: r.win,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      lane: r.lane,
      role: r.role,
      queueId: r.match.queueId,
      gameStartAt: r.match.gameStartAt?.toISOString() ?? null,
      durationSec: r.match.durationSec,
      patch: r.match.patch,
    }));
  }

  @Get(':id/matches')
  async getRecentMatches(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) throw new NotFoundException('Account not found');

    // Clamp pagination params to safe ranges.
    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const skip = Math.max(Number(offset) || 0, 0);

    const [total, matches] = await Promise.all([
      this.prisma.matchParticipant.count({ where: { riotAccId: id } }),
      this.readMatchesPage(id, take, skip),
    ]);

    return { accountId: id, total, matches };
  }

  // Gets detailed per-game stats for the tracked player in a single match,
  // read from the stored raw Riot response.
  @Get(':id/matches/:matchId/details')
  async getMatchDetails(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
  ) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
      select: { puuid: true },
    });

    if (!account) throw new NotFoundException('Account not found');

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { raw: true },
    });

    if (!match || !match.raw) {
      throw new NotFoundException('Match details not available');
    }

    const raw = match.raw as {
      info?: { participants?: Array<Record<string, unknown>> };
    };
    const participants = raw.info?.participants ?? [];
    const p = participants.find((x) => x.puuid === account.puuid);

    if (!p) throw new NotFoundException('Player not found in match');

    const num = (v: unknown) => Number(v ?? 0);

    return {
      matchId,
      champLevel: num(p.champLevel),
      cs: num(p.totalMinionsKilled) + num(p.neutralMinionsKilled),
      goldEarned: num(p.goldEarned),
      damageDealtToChampions: num(p.totalDamageDealtToChampions),
      damageTaken: num(p.totalDamageTaken),
      items: [
        num(p.item0),
        num(p.item1),
        num(p.item2),
        num(p.item3),
        num(p.item4),
        num(p.item5),
        num(p.item6),
      ],
    };
  }

  // Pulls the next page of matches from Riot, persists them, and returns them.
  // `offset` is how many of the player's matches the client already has.
  @Post(':id/matches/load-more')
  async loadMoreMatches(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const account = await this.prisma.riotAccount.findUnique({
      where: { id },
      select: { id: true, puuid: true },
    });

    if (!account) throw new NotFoundException('Account not found');

    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const skip = Math.max(Number(offset) || 0, 0);

    // Fetch the next slice of the player's history from Riot and persist it.
    const sync = await this.matchSync.syncRecentMatches(
      account.puuid,
      take,
      skip,
    );

    const matches = await this.readMatchesPage(id, take, skip);

    return {
      accountId: id,
      matches,
      // A full page back from Riot means there is likely more history to load.
      hasMore: sync.matchCountFetched === take,
    };
  }
}
