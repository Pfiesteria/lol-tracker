# LoL Tracker

A personal League of Legends match tracker. Look up a Riot account, sync recent
matches from the Riot API, and browse per-account stats, champion win rates, and
detailed per-game breakdowns.

## Architecture

A pnpm monorepo:

| Path              | What it is                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `apps/api/api`    | NestJS REST API — Riot API integration, match sync, stats         |
| `apps/web`        | Next.js (App Router) frontend                                     |
| `packages/db`     | Shared Prisma client + schema/migrations (Postgres)               |
| `infra`           | `docker-compose.yml` for local Postgres + Redis                   |

The web app proxies `/api/*` to the API via a Next.js rewrite (`apps/web/next.config.ts`),
so the browser only ever talks to the Next.js origin.

## Prerequisites

- Node.js 20+
- pnpm 11 (`corepack enable` will pick up the pinned version)
- Docker (for local Postgres/Redis)
- A Riot API key — https://developer.riotgames.com/

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment (copy the examples and fill in real values)
cp infra/.env.example         infra/.env          # set POSTGRES_PASSWORD
cp apps/api/api/.env.example  apps/api/api/.env    # set RIOT_API_KEY, DATABASE_URL
cp packages/db/.env.example   packages/db/.env     # set DATABASE_URL
cp apps/web/.env.example      apps/web/.env.local  # optional; defaults to localhost

# 3. Start Postgres + Redis
docker compose -f infra/docker-compose.yml up -d

# 4. Apply database migrations and generate the Prisma client
pnpm db:migrate

# 5. Run the apps (in separate terminals)
pnpm dev:api   # http://localhost:3001  (Swagger docs at /docs in dev)
pnpm dev:web   # http://localhost:3000
```

## Environment variables

| Variable              | Used by      | Description                                            |
| --------------------- | ------------ | ----------------------------------------------------- |
| `DATABASE_URL`        | api, db      | Postgres connection string                            |
| `RIOT_API_KEY`        | api          | Riot Games API key                                    |
| `RIOT_REGION_ROUTING` | api          | Default regional routing for match-v5 (`americas`, …) |
| `PORT`                | api          | API port (default `3001`)                             |
| `CORS_ORIGIN`         | api          | Allowed browser origin(s), comma-separated            |
| `NODE_ENV`            | api          | `development` \| `production` \| `test`               |
| `API_URL`             | web          | Backend base URL the `/api/*` rewrite targets         |
| `POSTGRES_*`          | infra        | Postgres credentials for docker-compose               |

The API validates required variables at startup (`apps/api/api/src/app.module.ts`)
and will refuse to boot if `DATABASE_URL` or `RIOT_API_KEY` is missing.

## Common scripts (run from the repo root)

```bash
pnpm build        # build all apps
pnpm lint         # lint all workspaces
pnpm test         # API unit tests
pnpm db:migrate   # create/apply a Prisma migration
pnpm db:studio    # open Prisma Studio
```

## Roadmap

- A background worker (`apps/worker`, backed by the Redis service in
  `infra/docker-compose.yml`) to move match ingestion out of the request path.
