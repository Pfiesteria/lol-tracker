import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

//Riot api response structure
type RiotAccountResponse = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

//Riot api response structure for match details
export type RiotMatchV5 = {
  metadata?: {
    matchId?: string;
    participants?: string[];
  };
  info?: {
    gameStartTimestamp?: number;
    gameDuration?: number;
    queueId?: number;
    gameVersion?: string;
    participants?: Array<{
      puuid?: string;
      championId?: number;
      teamId?: number;
      win?: boolean;
      kills?: number;
      deaths?: number;
      assists?: number;
      lane?: string;
      role?: string;
    }>;
  };
};

// Helper to map platform routing values to regional routing for match v5 endpoints
function platformToRegionalRouting(platform: string): string {
  const p = platform.toLowerCase();

  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(p)) return 'americas';
  if (['euw1', 'eun1', 'tr1', 'ru'].includes(p)) return 'europe';
  if (['kr', 'jp1'].includes(p)) return 'asia';
  if (['ph2', 'sg2', 'th2', 'tw2', 'vn2'].includes(p)) return 'sea';

  return 'americas';
}

@Injectable()
export class RiotService {
  constructor(private readonly http: HttpService) {}

  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    region: string,
    apiKey: string,
  ): Promise<RiotAccountResponse> {
    const safeGameName = gameName.trim();
    const safeTagLine = tagLine.trim().toLowerCase();

    const regionalRouting = platformToRegionalRouting(region);

    const url = `https://${regionalRouting}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      safeGameName,
    )}/${encodeURIComponent(safeTagLine)}`;

    try {
      const response = await firstValueFrom(
        this.http.get<RiotAccountResponse>(url, {
          headers: { 'X-Riot-Token': apiKey },
        }),
      );

      return response.data;
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;

      if (status === 404) {
        throw new HttpException('Riot account not found', HttpStatus.NOT_FOUND);
      }

      if (status === 403) {
        throw new HttpException(
          'Invalid or expired Riot API key',
          HttpStatus.FORBIDDEN,
        );
      }

      throw new HttpException(
        'Failed to fetch Riot account',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  //Gets match IDs for the account with the given puuid
  async getMatchIdsByPuuid(
    puuid: string,
    regionRouting: string,
    apiKey: string,
    start = 0,
    count = 20,
  ): Promise<string[]> {
    const url = `https://${regionRouting}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid,
    )}/ids?start=${start}&count=${count}`;

    try {
      const response = await firstValueFrom(
        this.http.get<string[]>(url, {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }),
      );
      return response.data;
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;

      if (status === 403) {
        throw new HttpException(
          'Invalid or expired Riot API key',
          HttpStatus.FORBIDDEN,
        );
      }

      throw new HttpException(
        'Failed to fetch match IDs',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getMatchById(
    matchId: string,
    regionRouting: string,
    apiKey: string,
  ): Promise<RiotMatchV5> {
    const url = `https://${regionRouting}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(
      matchId,
    )}`;

    try {
      const response = await firstValueFrom(
        this.http.get<RiotMatchV5>(url, {
          headers: { 'X-Riot-Token': apiKey },
        }),
      );
      return response.data;
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;

      if (status === 403) {
        throw new HttpException(
          'Invalid or expired Riot API key',
          HttpStatus.FORBIDDEN,
        );
      }

      throw new HttpException(
        'Failed to fetch match details',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
