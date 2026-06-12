"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  RiotAccount,
  AccountStats,
  ChampionsResponse,
  MatchesResponse,
} from "@/lib/api";
import { ChampionMetadata, getChampionMetadataMap } from "@/lib/champions";
const RECENT_MATCHES_LIMIT = 10;

//States for loading, syncing, error, stats, and champion data.
export default function DashboardClient({ accountId }: { accountId: string }) {
  const [account, setAccount] = useState<RiotAccount | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [champs, setChamps] = useState<ChampionsResponse | null>(null);
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [championMetadata, setChampionMetadata] = useState<
    Map<number, ChampionMetadata>
  >(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);


  /*
    * Loads stats, champion data, and recent matches.
  */
  async function load() {
    setError(null);
    setLoading(true);

    // Load stats and champions together
    try {
      const [a, s, c, m] = await Promise.all([
        api.getAccount(accountId),
        api.getStats(accountId),
        api.getChampions(accountId),
        api.getMatches(accountId, RECENT_MATCHES_LIMIT, 0),
      ]);
      setAccount(a);
      setStats(s);
      setChamps(c);
      setMatches(m);
      // A full first page suggests Riot likely has older matches to load.
      setHasMore(m.matches.length >= RECENT_MATCHES_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setAccount(null);
      setStats(null);
      setChamps(null);
      setMatches(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    let mounted = true;

    void getChampionMetadataMap()
      .then((map) => {
        if (mounted) {
          setChampionMetadata(map);
        }
      })
      .catch(() => {
        // Keep fallback to champion IDs when name mapping fetch fails.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const championRows = useMemo(() => champs?.champions ?? [], [champs]);
  //All loaded matches sorted by most recent date
  const matchRows = useMemo(() => {
    const rows = [...(matches?.matches ?? [])];

    rows.sort((a, b) => {
      const aTime = a.gameStartAt ? new Date(a.gameStartAt).getTime() : 0;
      const bTime = b.gameStartAt ? new Date(b.gameStartAt).getTime() : 0;
      return bTime - aTime;
    });

    return rows;
  }, [matches]);

  //Pulls the next 10 games from Riot, persists them, and appends to the list.
  async function onLoadMore() {
    if (!matches) return;
    setError(null);
    setLoadingMore(true);

    try {
      const next = await api.loadMoreMatches(
        accountId,
        RECENT_MATCHES_LIMIT,
        matches.matches.length,
      );

      // Append only matches we don't already have (guards against overlap).
      const existingIds = new Set(matches.matches.map((m) => m.matchId));
      const fresh = next.matches.filter((m) => !existingIds.has(m.matchId));

      setMatches({
        ...matches,
        total: matches.total + fresh.length,
        matches: [...matches.matches, ...fresh],
      });
      setHasMore(next.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingMore(false);
    }
  }

  async function onSync() {
    setError(null);  
    setSyncing(true);

    try {
      await api.syncAccount(accountId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  }
  //Gets current account name
  const dashboardTitle = account?.gameName
    ? `${toPossessive(account.gameName)} stats`
    : "Current User ID's stats";


  /*
    * Renders  dashboard UI, showing loading state, errors, stats, and champion data.
  */
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{dashboardTitle}</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-md bg-blue-500 border px-4 py-2 text-sm">
            Return to Home
          </Link>
          <button
            onClick={onSync}
            disabled={syncing}
            className="rounded-md bg-blue-500 border px-4 py-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Recent Matches"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : !stats ? (
        <div className="text-sm text-neutral-600">No stats loaded.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <section className="rounded-xl border p-4 lg:col-span-4">
              <h2 className="text-lg font-medium">Champions</h2>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="border-b">
                      <th className="py-2 pr-3">Champion</th>
                      <th className="py-2 pr-3">Games</th>
                      <th className="py-2 pr-3">Wins</th>
                      <th className="py-2 pr-3">Losses</th>
                      <th className="py-2 pr-3">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {championRows.map((r) => (
                      <tr key={r.championId} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          {championMetadata.get(r.championId)?.name ??
                            `Champion ${r.championId}`}
                        </td>
                        <td className="py-2 pr-3">{r.games}</td>
                        <td className="py-2 pr-3">{r.wins}</td>
                        <td className="py-2 pr-3">{r.losses}</td>
                        <td className="py-2 pr-3">
                          {r.winRatePercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}

                    {championRows.length === 0 && (
                      <tr>
                        <td className="py-3 text-neutral-600" colSpan={5}>
                          No champion data returned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border p-4 lg:col-span-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">Recent Matches</h2>
                <div className="text-xs text-neutral-600">
                  Showing {matchRows.length} {matchRows.length === 1 ? "match" : "matches"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Win Rate" value={`${stats.winRatePercent}%`} />
                <Stat
                  label="K / D / A"
                  value={`${stats.averages.kills} / ${stats.averages.deaths} / ${stats.averages.assists}`}
                />
                <Stat label="KDA" value={`${stats.averages.kda}`} />
                <Stat label="Record" value={`${stats.wins}-${stats.losses}`} />
              </div>

              <div className="mt-4 space-y-3">
                {matchRows.map((m) => (
                  <div
                    key={m.matchId}
                    className={`rounded-xl border p-4 ${
                      m.win
                        ? "border-blue-300 bg-blue-100 text-blue-950"
                        : "border-red-300 bg-red-100 text-red-950"
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
                      <div className="md:col-span-3">
                        <div
                          className={`text-xs ${
                            m.win ? "text-blue-800" : "text-red-800"
                          }`}
                        >
                          {formatQueueName(m.queueId)}
                        </div>
                        <div className="text-sm font-medium">
                          {formatDuration(m.durationSec)}
                        </div>
                        <div
                          className={`mt-1 text-xs ${
                            m.win ? "text-blue-700" : "text-red-700"
                          }`}
                        >
                          {formatRelativeTime(m.gameStartAt)}
                        </div>
                      </div>


                      <div className="md:col-span-5 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {(() => {
                            //Creates the player cards with champ name and icons
                            const champ = championMetadata.get(m.championId);
                            const iconUrl = champ?.iconUrl;
                            return iconUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={iconUrl}
                                alt={champ?.name ?? `Champion ${m.championId}`}
                                width={40}
                                height={40}
                                style={{ borderRadius: 4, background: '#eee' }}
                              />
                            ) : null;
                          })()}
                          <span className="text-lg font-semibold">
                            {championMetadata.get(m.championId)?.name ??
                              `Champion ${m.championId}`}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-xl font-bold tracking-tight">
                            {m.kills} / {m.deaths} / {m.assists}
                          </div>
                          <div
                            className={`text-sm ${
                              m.win ? "text-blue-800" : "text-red-800"
                            }`}
                          >
                            {computeKdaRatio(m.kills, m.deaths, m.assists)} KDA
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-4 md:text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            m.win
                              ? "bg-blue-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {m.win ? "Victory" : "Defeat"}
                        </span>
                        <div
                          className={`mt-2 text-xs ${
                            m.win ? "text-blue-700" : "text-red-700"
                          }`}
                        >
                          {m.patch ? `Patch ${m.patch}` : "Patch Unknown"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {matchRows.length === 0 && (
                  <div className="text-sm text-neutral-600">
                    No recent matches available.
                  </div>
                )}
              </div>

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="rounded-md bg-blue-500 border px-4 py-2 text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function toPossessive(name: string): string {
  if (!name) return "User's";

  const endsWithS = /s$/i.test(name);
  return endsWithS ? `${name}'` : `${name}'s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function formatDuration(durationSec: number | null): string {
  if (typeof durationSec !== "number") return "Unknown duration";

  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function formatQueueName(queueId: number | null): string {
  switch (queueId) {
    case 1750:
      return "Arena";
    case 420:
      return "Ranked Solo/Duo";
    case 440:
      return "Ranked Flex";
    case 450:
      return "ARAM";
    case 400:
      return "Normal Draft";
    case 430:
      return "Normal Blind";
    default:
      return queueId ? `Queue ${queueId}` : "Unknown Queue";
  }
}

function formatRelativeTime(gameStartAt: string | null): string {
  if (!gameStartAt) return "Unknown time";

  const now = Date.now();
  const start = new Date(gameStartAt).getTime();
  const diffMs = Math.max(0, now - start);
  const mins = Math.floor(diffMs / (1000 * 60));

  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function computeKdaRatio(
  kills: number,
  deaths: number,
  assists: number,
): string {
  const ratio = deaths === 0 ? kills + assists : (kills + assists) / deaths;
  return ratio.toFixed(2);
}