import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
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

// Regional routing values used by account-v1 and match-v5 endpoints.
// This is what an account's `region` is validated against (see CreateAccountDto).
export const REGIONAL_ROUTES = ['americas', 'europe', 'asia', 'sea'] as const;

// Normalizes a caller-supplied region to a valid regional routing value.
function toRegionalRouting(region: string): string {
  const r = region.toLowerCase();
  return (REGIONAL_ROUTES as readonly string[]).includes(r) ? r : 'americas';
}

@Injectable()
export class RiotService {
  private readonly logger = new Logger(RiotService.name);

  constructor(private readonly http: HttpService) {}

  // Maps an Axios failure from the Riot API to a meaningful HttpException.
  // Handles auth (403) and rate-limit (429) explicitly; everything else is a 502.
  private toRiotHttpException(err: unknown, fallbackMessage: string): never {
    const error = err as AxiosError;
    const status = error.response?.status;

    if (status === 403) {
      throw new HttpException(
        'Invalid or expired Riot API key',
        HttpStatus.FORBIDDEN,
      );
    }

    if (status === 429) {
      const header = error.response?.headers?.['retry-after'] as
        | string
        | number
        | undefined;
      const retryAfter = header != null ? String(header) : undefined;
      this.logger.warn(
        `Riot API rate limit hit (retry-after=${retryAfter ?? 'n/a'})`,
      );
      throw new HttpException(
        `Riot API rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.warn(`${fallbackMessage} (status=${status ?? 'unknown'})`);
    throw new HttpException(fallbackMessage, HttpStatus.BAD_GATEWAY);
  }

  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    region: string,
    apiKey: string,
  ): Promise<RiotAccountResponse> {
    const safeGameName = gameName.trim();
    const safeTagLine = tagLine.trim().toLowerCase();

    const regionalRouting = toRegionalRouting(region);

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
      const status = (err as AxiosError).response?.status;
      if (status === 404) {
        throw new HttpException('Riot account not found', HttpStatus.NOT_FOUND);
      }
      this.toRiotHttpException(err, 'Failed to fetch Riot account');
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
      this.toRiotHttpException(err, 'Failed to fetch match IDs');
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
      this.toRiotHttpException(err, 'Failed to fetch match details');
    }
  }
}
