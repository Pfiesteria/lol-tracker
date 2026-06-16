# Plan: Expandable per-game player stats on match cards

## Context

The dashboard's match history (`DashboardClient.tsx`) currently shows only a one-line
summary per game: champion, K/D/A, win/loss, queue, duration, patch. The user wants to
click a match card to expand a dropdown showing **more detailed stats for the tracked
player in that specific game** — specifically **CS & gold, damage, items, and champion
level**.

Key enabler discovered during exploration: the full Riot match response is **already
persisted** in `Match.raw` (JSON) for every synced match. So all of these stats are
available without new Riot API calls, new DB columns, or a re-sync — we just need to
extract the tracked player's participant block from `raw` and surface it.

Scope confirmed with the user:
- **Whose stats:** just the tracked player (not a full 10-player scoreboard).
- **Which stats:** Damage, CS & gold, Items, champion Level.

## Approach

Add a lazily-loaded detail endpoint that reads `Match.raw`, plus a click-to-expand panel
on each match card. Nothing about the existing list/pagination flow changes.

### 1. Backend — new detail endpoint

File: `apps/api/api/src/accounts/accounts.controller.ts`

Add `GET /accounts/:id/matches/:matchId/details`:
- Look up the account by `id` to get its `puuid` (and 404-style `{ error }` if missing,
  matching the existing convention in this controller).
- Load the match: `prisma.match.findUnique({ where: { id: matchId }, select: { raw: true } })`.
  Return `{ error }` if not found or `raw` is null.
- From `raw.info.participants`, find the entry where `p.puuid === account.puuid`.
- Extract and return a typed object (all numeric fields coerced with `Number(... ?? 0)`,
  mirroring the existing defensive style in `match-sync.service.ts`):
  - `champLevel`
  - `cs` = `totalMinionsKilled + neutralMinionsKilled`
  - `goldEarned`
  - `damageDealtToChampions` (`totalDamageDealtToChampions`)
  - `damageTaken` (`totalDamageTaken`)
  - `items` = `[item0, item1, item2, item3, item4, item5, item6]` (item6 is the trinket;
    a value of `0` means an empty slot and should render as a blank box)

Return shape: `{ matchId, champLevel, cs, goldEarned, damageDealtToChampions, damageTaken, items }`.

Note: the `RiotMatchV5` type in `riot.service.ts` only declares a few participant fields.
Since we read the untyped `raw` JSON here (not that type), no change to `RiotMatchV5` is
required; access the extra fields off the parsed JSON. (Optionally extend `RiotMatchV5`'s
participant type for clarity, but not necessary.)

### 2. Frontend API client

File: `apps/web/src/lib/api.ts`
- Add `MatchDetails` type matching the endpoint response.
- Add `api.getMatchDetails(accountId, matchId)` → `apiFetch<MatchDetails>(\`/accounts/${accountId}/matches/${matchId}/details\`)`,
  following the existing `getMatches` pattern.

### 3. Frontend — item icon helper (DataDragon)

File: `apps/web/src/lib/champions.ts` (reuse this module; it already owns the DDragon
version/CDN logic) — add a small helper alongside the champion map:
- `getLatestDDragonVersion()` — memoized fetch of `versions.json[0]`, mirroring the
  existing `championMetadataMapPromise` memoization pattern (lines 19, 66-74).
- `getItemIconUrl(version, itemId)` → `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`.

In `DashboardClient.tsx`, fetch the version once (a `useEffect` like the existing champion
metadata effect, lines 70-86) and store it in state so item icons can render.

### 4. Frontend — expandable card UI

File: `apps/web/src/app/dashboard/[accountId]/DashboardClient.tsx`

State (add near existing `useState`s, lines 17-30):
- `expandedMatchId: string | null` — which card is open (single-open accordion; simplest).
- `matchDetails: Map<string, MatchDetails>` — cache of fetched details, keyed by matchId.
- `detailsLoading: Set<string>` and an optional per-card `detailsError`.
- `ddragonVersion: string | null` — for item icons.

Behavior:
- Wrap the existing card inner content (the `md:grid-cols-12` row, lines 255-331) so the
  whole header row is a clickable toggle (button/`role="button"`). Add a small chevron/caret
  indicator that rotates when open. Keep existing win/loss color classes.
- On expand, if details aren't cached and not loading, call `api.getMatchDetails(...)`,
  store the result in the `matchDetails` map. Show "Loading…" / error inline using the same
  muted text styles already in the file.
- Render an expanded panel below the header row (inside the same card `div`, after line 331),
  shown only when `expandedMatchId === m.matchId`. Use a responsive grid of small stat tiles
  reusing the existing `Stat` component (lines 368-375) for:
  - **Level** (`champLevel`)
  - **CS** (`cs`, optionally with CS/min computed from `m.durationSec` using the existing
    `formatDuration` neighbor logic)
  - **Gold** (`goldEarned`, formatted with thousands separators)
  - **Damage to champs** (`damageDealtToChampions`)
  - **Damage taken** (`damageTaken`)
  - **Items**: a row of 7 small icon boxes; non-zero items use `getItemIconUrl`, zero slots
    render as empty bordered squares. Use plain `<img>` with the existing
    `eslint-disable @next/next/no-img-element` approach already used for champion icons
    (lines 284-291).

Styling: Tailwind utilities only (the project uses Tailwind v4, no CSS modules). Match the
existing border/rounded/padding idiom.

## Critical files
- `apps/api/api/src/accounts/accounts.controller.ts` — new detail endpoint.
- `apps/web/src/lib/api.ts` — `MatchDetails` type + `getMatchDetails`.
- `apps/web/src/lib/champions.ts` — DDragon version + item icon helpers.
- `apps/web/src/app/dashboard/[accountId]/DashboardClient.tsx` — expand state + panel UI.

## Verification
1. Start API and web app (existing dev scripts).
2. Open a dashboard with synced matches (`/dashboard/[accountId]`).
3. Click a match card → it expands; details load once and show Level, CS, Gold, Damage
   dealt/taken, and item icons. Empty item slots render as blank boxes.
4. Collapse and re-expand the same card → no second network request (served from cache).
5. Expand a different card → first one closes (single-open accordion).
6. Sanity-check the endpoint directly:
   `GET /api/accounts/<id>/matches/<matchId>/details` returns the expected JSON.
7. Confirm a match with no/null `raw` or a match the player isn't in returns a graceful
   `{ error }` and the UI shows an inline error rather than crashing.
8. Cross-check a game's numbers (KDA already shown vs. CS/gold/items) against op.gg or the
   in-client match history for correctness.
