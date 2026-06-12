export type CreateAccountBody = {
  gameName: string;
  tagLine: string;
  region: string;
};

export type RiotAccount = {
  id: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountStats = {
  accountId: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRatePercent: number;
  averages: {
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
  };
};

export type ChampionAgg = {
  championId: number;
  games: number;
  wins: number;
  losses: number;
  winRatePercent: number;
};

export type ChampionsResponse = {
  accountId: string;
  champions: ChampionAgg[];
};

export type MatchSummary = {
  matchId: string;
  championId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lane: string | null;
  role: string | null;
  queueId: number | null;
  gameStartAt: string | null;
  durationSec: number | null;
  patch: string | null;
};

export type MatchesResponse = {
  accountId: string;
  total: number;
  matches: MatchSummary[];
};

export type LoadMoreResponse = {
  accountId: string;
  matches: MatchSummary[];
  hasMore: boolean;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  createAccount(body: CreateAccountBody) {
    return apiFetch<RiotAccount>("/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getAccount(accountId: string) {
    return apiFetch<RiotAccount>(`/accounts/${accountId}`);
  },

  syncAccount(accountId: string) {
    return apiFetch(`/accounts/${accountId}/sync`, {
      method: "POST",
    });
  },

  getStats(accountId: string) {
    return apiFetch<AccountStats>(`/accounts/${accountId}/stats`);
  },

  getChampions(accountId: string) {
    return apiFetch<ChampionsResponse>(`/accounts/${accountId}/champions`);
  },

  getMatches(accountId: string, limit = 10, offset = 0) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return apiFetch<MatchesResponse>(
      `/accounts/${accountId}/matches?${params.toString()}`,
    );
  },

  // Pulls the next page of matches from Riot, persists them, and returns them.
  loadMoreMatches(accountId: string, limit = 10, offset = 0) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return apiFetch<LoadMoreResponse>(
      `/accounts/${accountId}/matches/load-more?${params.toString()}`,
      { method: "POST" },
    );
  },
};