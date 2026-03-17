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
};