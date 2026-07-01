// Riot's DataDragon CDN. Centralized so a future host/path change is one edit.
const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

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
  const versionsRes = await fetch(`${DDRAGON_BASE}/api/versions.json`);

  if (!versionsRes.ok) {
    throw new Error("Failed to fetch champion versions");
  }

  const versions = (await versionsRes.json()) as DDragonVersionsResponse;
  const latest = versions[0];

  if (!latest) {
    throw new Error("No champion versions available");
  }

  const champsRes = await fetch(
    `${DDRAGON_BASE}/cdn/${latest}/data/en_US/champion.json`,
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
        iconUrl: `${DDRAGON_BASE}/cdn/${latest}/img/champion/${champ.id}.png`,
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

let latestVersionPromise: Promise<string> | null = null;

//Memoized fetch of the latest DataDragon version, used to build item icon URLs.
export async function getLatestDDragonVersion(): Promise<string> {
  if (!latestVersionPromise) {
    latestVersionPromise = (async () => {
      const versionsRes = await fetch(`${DDRAGON_BASE}/api/versions.json`);

      if (!versionsRes.ok) {
        throw new Error("Failed to fetch DataDragon versions");
      }

      const versions = (await versionsRes.json()) as DDragonVersionsResponse;
      const latest = versions[0];

      if (!latest) {
        throw new Error("No DataDragon versions available");
      }

      return latest;
    })();
  }

  return latestVersionPromise;
}

//Builds the DataDragon icon URL for a given item id (0 means an empty slot).
export function getItemIconUrl(version: string, itemId: number): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/item/${itemId}.png`;
}
