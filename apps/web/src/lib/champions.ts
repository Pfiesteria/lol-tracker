type DDragonVersionsResponse = string[];

type DDragonChampionRecord = {
  id: string;
  key: string;
  name: string;
};

export type ChampionMetadata = {
  id: string;
  name: string;
  iconUrl: string;
};

type DDragonChampionsResponse = {
  data: Record<string, DDragonChampionRecord>;
};

let championMetadataMapPromise: Promise<Map<number, ChampionMetadata>> | null =
  null;

//Gets more metadata about champions to map the champion ID to the correct names
async function fetchChampionMetadataMap(): Promise<
  Map<number, ChampionMetadata>
> {
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
  const map = new Map<number, ChampionMetadata>();

  for (const champ of Object.values(payload.data)) {
    const numericId = Number(champ.key);
    if (!Number.isNaN(numericId)) {
      map.set(numericId, {
        id: champ.id,
        name: champ.name,
        iconUrl: `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.id}.png`,
      });
    }
  }

  return map;
}

export async function getChampionMetadataMap(): Promise<
  Map<number, ChampionMetadata>
> {
  if (!championMetadataMapPromise) {
    championMetadataMapPromise = fetchChampionMetadataMap();
  }

  return championMetadataMapPromise;
}
