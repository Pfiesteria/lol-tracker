"use client";

import { useEffect, useMemo, useState } from "react";
import { api, AccountStats, ChampionsResponse } from "@/lib/api";


//States for loading, syncing, error, stats, and champion data.
export default function DashboardClient({ accountId }: { accountId: string }) {
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [champs, setChamps] = useState<ChampionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  /*
    * Loads both stats and champion data. Used on initial load and after syncing.
  */
  async function load() {
    setError(null);
    setLoading(true);

    // Load stats and champions together
    try {
      const [s, c] = await Promise.all([
        api.getStats(accountId),
        api.getChampions(accountId),
      ]);
      setStats(s);
      setChamps(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStats(null);
      setChamps(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const rows = useMemo(() => champs?.champions ?? [], [champs]);

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


  /*
    * Renders  dashboard UI, showing loading state, errors, stats, and champion data.
  */
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={onSync}
          disabled={syncing}
          className="rounded-md border px-4 py-2 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Recent Matches"}
        </button>
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
          <section className="rounded-xl border p-4">
            <h2 className="text-lg font-medium">
              Stats (last {stats.totalGames})
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Win Rate" value={`${stats.winRatePercent}%`} />
              <Stat
                label="K / D / A"
                value={`${stats.averages.kills} / ${stats.averages.deaths} / ${stats.averages.assists}`}
              />
              <Stat label="KDA" value={`${stats.averages.kda}`} />
              <Stat label="Record" value={`${stats.wins}-${stats.losses}`} />
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="text-lg font-medium">Champions</h2>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b">
                    <th className="py-2 pr-3">Champion ID</th>
                    <th className="py-2 pr-3">Games</th>
                    <th className="py-2 pr-3">Wins</th>
                    <th className="py-2 pr-3">Losses</th>
                    <th className="py-2 pr-3">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.championId} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">{r.championId}</td>
                      <td className="py-2 pr-3">{r.games}</td>
                      <td className="py-2 pr-3">{r.wins}</td>
                      <td className="py-2 pr-3">{r.losses}</td>
                      <td className="py-2 pr-3">
                        {r.winRatePercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
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
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}