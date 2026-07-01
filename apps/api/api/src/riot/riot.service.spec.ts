import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { RiotService, REGIONAL_ROUTES } from './riot.service';

describe('RiotService', () => {
  let service: RiotService;
  let http: { get: jest.Mock };

  const axiosError = (
    status: number,
    headers: Record<string, string> = {},
  ) => ({
    isAxiosError: true,
    response: { status, headers },
  });

  beforeEach(async () => {
    http = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RiotService, { provide: HttpService, useValue: http }],
    }).compile();

    service = module.get<RiotService>(RiotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('exposes the regional routes used by the DTO validator', () => {
    expect(REGIONAL_ROUTES).toEqual(['americas', 'europe', 'asia', 'sea']);
  });

  it('uses the regional routing value as the account-v1 host', async () => {
    http.get.mockReturnValue(
      of({ data: { puuid: 'p', gameName: 'g', tagLine: 't' } }),
    );

    await service.getAccountByRiotId('Name', 'NA1', 'europe', 'key');

    const calls = http.get.mock.calls as string[][];
    expect(calls[0][0]).toContain('https://europe.api.riotgames.com');
  });

  it('falls back to americas for an unrecognized region', async () => {
    http.get.mockReturnValue(
      of({ data: { puuid: 'p', gameName: 'g', tagLine: 't' } }),
    );

    await service.getAccountByRiotId('Name', 'NA1', 'nonsense', 'key');

    const calls = http.get.mock.calls as string[][];
    expect(calls[0][0]).toContain('https://americas.api.riotgames.com');
  });

  it('maps a 404 to NotFound for account lookups', async () => {
    http.get.mockReturnValue(throwError(() => axiosError(404)));

    await expect(
      service.getAccountByRiotId('Name', 'NA1', 'na1', 'key'),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });

  it('maps a 403 to Forbidden', async () => {
    http.get.mockReturnValue(throwError(() => axiosError(403)));

    await expect(
      service.getMatchById('NA1_1', 'americas', 'key'),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
  });

  it('maps a 429 to TooManyRequests', async () => {
    http.get.mockReturnValue(
      throwError(() => axiosError(429, { 'retry-after': '10' })),
    );

    await expect(
      service.getMatchIdsByPuuid('puuid', 'americas', 'key'),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('maps other errors to a 502 Bad Gateway', async () => {
    http.get.mockReturnValue(throwError(() => axiosError(500)));

    await expect(
      service.getMatchById('NA1_1', 'americas', 'key'),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
  });

  it('throws an HttpException instance (not a raw error)', async () => {
    http.get.mockReturnValue(throwError(() => axiosError(500)));

    await expect(
      service.getMatchById('NA1_1', 'americas', 'key'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
