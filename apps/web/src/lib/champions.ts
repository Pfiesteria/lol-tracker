type DDragonVersionsResponse = string[];

type DDragonChampionRecord = {
  id: string;
  key: string;
  name: string;
};

type DDragonChampionsResponse = {
  data: Record<string, DDragonChampionRecord>;
};

let championNameMapPromise: Promise<Map<number, string>> | null = null;

async function fetchChampionNameMap(): Promise<Map<number, string>> {
  const versionsRes = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json",
  );

  if (!versionsRes.ok) {
    throw new Error("Failed to fetch champion versions");
  }

  const versions = (await versionsRes.json()) as DDragonVersionsResponse;
  const latest = versions[0];

  if (!latest) {
    throw new Error("No champion versions available");
  }

  const champsRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`,
  );

  if (!champsRes.ok) {
    throw new Error("Failed to fetch champion metadata");
  }

  const payload = (await champsRes.json()) as DDragonChampionsResponse;
  const map = new Map<number, string>();

  for (const champ of Object.values(payload.data)) {
    const id = Number(champ.key);
    if (!Number.isNaN(id)) {
      map.set(id, champ.name);
    }
  }

  return map;
}

export async function getChampionNameMap(): Promise<Map<number, string>> {
  if (!championNameMapPromise) {
    championNameMapPromise = fetchChampionNameMap();
  }

  return championNameMapPromise;
}
