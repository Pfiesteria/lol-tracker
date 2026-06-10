"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [region, setRegion] = useState("americas");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const account = await api.createAccount({ gameName, tagLine, region });
      router.push(`/dashboard/${account.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-6">
      <h1 className="absolute top-6 left-1/2 w-full -translate-x-1/2 text-center text-5xl font-semibold">
        League of Legends Tracker
      </h1>

      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-xl border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <div className="text-sm font-medium">Summoner ID</div>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Pfiesteria"
              required
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Tag Line</div>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value)}
              placeholder="e.g. NA1"
              required
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium">Region</div>
            <select
              className="w-full rounded-md border bg-black px-3 py-2 text-white"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            >
              <option value="americas">americas</option>
              <option value="europe">europe</option>
              <option value="asia">asia</option>
              <option value="sea">sea</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search Account"}
        </button>
      </form>
    </main>
  );
}