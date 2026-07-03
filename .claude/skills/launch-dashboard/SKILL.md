---
name: launch-dashboard
description: Launch and verify the Abitare Marketing Dashboard (Postgres + Express backend + Next.js frontend) in this repo. Use when asked to run, start, or screenshot the app, or to confirm a change works end to end.
---

# Launch: Abitare Marketing Dashboard

## Prerequisites

- Docker Desktop must be running (`docker info` should not error). On Windows the
  Docker Desktop *application* itself is often not running yet (not just the
  container) — if `docker info` errors with a pipe/engine-not-found message, launch
  it and poll until ready before anything else:
  ```powershell
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ```
  ```bash
  timeout 120 bash -c 'until docker info >/dev/null 2>&1; do sleep 3; done; echo ready'
  ```
- `.env` exists at repo root (`cp .env.example .env` if not, then fill credentials —
  see `docs/architecture.md`). Real credentials are wired up with
  **`DRY_RUN=false`** — the daily cron and the manual sync both write real data.
  Don't assume dry-run mode; check `.env` directly if unsure.

## Launch sequence

```bash
# 1. Postgres (skip if already up: `docker ps` to check)
npm run docker:up
# wait for healthy, or poll:
docker inspect --format='{{.State.Health.Status}}' abitare_marketing_db

# 2. Migrations (only needed once / after new migration files)
npm run migrate

# 3. Backend (Express, :3001) — run in background
node apps/backend/server.js &
# on startup it also activates the daily sync scheduler (cron, default 6am) --
# check the boot log line "ETL programado activo" to confirm DRY_RUN state

# 4. Frontend (Next.js, :3000) — run in background
cd apps/frontend && npm run dev &
```

On Windows, if a port is already bound by a stale process from a previous session:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Verify

```bash
curl -s http://localhost:3001/api/health
curl -s "http://localhost:3001/api/kpis/summary?from=2026-06-01&to=2026-06-30"
curl -s "http://localhost:3001/api/kpis/platform-comparison?from=2026-06-01&to=2026-06-30"
curl -s http://localhost:3000/ | head -c 200   # SSR should include "Abitare Marketing Dashboard"
# force a fresh sync on demand (same as the "Actualizar datos" button):
curl -s -X POST http://localhost:3001/api/sync/run
```

For a real visual check (the dashboard is a Tremor/Tailwind UI — compiling without
errors does **not** mean it renders correctly, see gotchas below):

```bash
npm install -D playwright && npx playwright install chromium
# write the .mjs screenshot script INTO THE REPO ROOT (not the scratchpad dir) --
#   `node script.mjs` resolves `playwright` from the nearest node_modules, and the
#   scratchpad dir isn't part of this project's module tree. Delete the script
#   after use.
# short script: chromium.launch() -> page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
#   -> page.screenshot({ fullPage: true }) -> read the PNG.
# afterwards: npm uninstall playwright -- it's not a project dependency, just used
#   for one-off visual verification.
```

The dashboard is a single stacked page with 5 "Niveles" (see `CLAUDE.md` for the
full Nivel → component → API route table): Nivel 1 (`ExecutiveKpiCards`, 7 cards
including "Reportadas por Meta/Google" in amber), Nivel 2 (`PlatformComparisonTable`
+ donuts), Nivel 3 (`EvolutionCharts`, día/semana toggle), Nivel 4 (`CampaignsTable`
— sortable via column-header click, searchable by name, sticky header, paginated
client-side at 20 rows/page with "Confirmadas"/"Reportadas" and "Ingresos"/"Ing.
reportados" shown side by side in amber vs. default — click "Siguiente" in a
screenshot check to confirm pagination works, not just that page 1 renders),
Nivel 6 (`DiagnosticKpiCards`). Nivel 5 (funnel) and a profit level are intentionally
not built yet. There's also a "Actualizar datos" button top-right (`SyncButton.jsx`)
that triggers `POST /api/sync/run` and refetches the whole page on success.

**Also check data plausibility, not just rendering** — a page can render perfectly
and still show wrong numbers (see the duplicate-rows gotcha below, which threw no
error anywhere and was only caught by a human noticing "Alcance" looked too
high/static). After loading real data, sanity-check with:

```bash
docker exec abitare_marketing_db psql -U abitare -d abitare_marketing -c \
  "SELECT platform, store, min(date), max(date), count(*), count(DISTINCT (store,campaign_id,adset_id,ad_id,date)) AS distinct_combos, sum(spend) FROM ad_performance GROUP BY platform, store ORDER BY platform, store;"
```

`count` must equal `distinct_combos` for every row (otherwise there are duplicate
rows inflating totals), and `min`/`max` dates should cover the range you actually
asked the pipeline to fetch (a partial/failed historical load can silently leave
a narrower date range than requested — cross-check against what
`fetchMetaInsights`/`fetchGoogleAdsPerformance` were called with, not just what's
in the DB).

## Gotchas already hit in this repo (don't rediscover these)

- **Tremor renders unstyled (no card borders, giant icons, deformed charts) unless
  `apps/frontend/tailwind.config.cjs`'s `content` includes
  `../../node_modules/@tremor/**`** (root node_modules — npm workspaces hoists the
  package out of `apps/frontend/node_modules`).
- **Donut/bar charts render solid black** unless the Tailwind `safelist` pattern
  includes `fill` and `stroke` prefixes, not just `bg|text|border|ring` — Tremor
  builds `fill-{color}-500` classes dynamically, which the static content scanner
  can't detect on its own.
- After editing `tailwind.config.cjs`, do a clean restart
  (`rm -rf apps/frontend/.next` before `npm run dev`) — stale CSS can persist
  otherwise.
- Real ad spend/order data lives in Postgres (loaded via `npm run etl:run` /
  `npm run import:sales`), not fixtures — if the dashboard looks empty, check the
  date range filter against what's actually in `ad_performance`/`orders` for that
  window (`docker exec abitare_marketing_db psql -U abitare -d abitare_marketing -c
  "SELECT store, date, spend FROM ad_performance ORDER BY date DESC LIMIT 5;"`).
- **Two date ranges giving the identical total isn't necessarily a filter bug** —
  it can just mean only one period's worth of data has ever been loaded (e.g. "last
  month" vs "last 6 months" look identical if only last month was ever fetched from
  the APIs). Check `min(date)`/`max(date)` in `ad_performance` before assuming the
  frontend/query logic is broken.
- **Re-running the pipeline for a large historical range (multi-month,
  `time_increment=1`) can partially fail per store/account** with transient Meta
  errors, silently leaving stale/narrower data for just that store while others
  load fine (`Promise.allSettled` means the pipeline reports success even if one
  store's fetch failed). Always check `min`/`max` date per store after a backfill,
  not just that the pipeline command exited without an error.
- **Nivel 1 (executive KPI cards) showing revenue/compras while Nivel 2
  (platform comparison) and Nivel 4 (campaigns table) show 0 for the same range
  is not necessarily a bug** — Nivel 1 counts every `attribution` row regardless
  of confidence, but Nivel 2/4 can only attribute revenue when
  `ad_performance_id` is set (requires a real campaign-name or click-id match).
  With a small CSV-imported order sample this gap is common. Confirm via
  `SELECT confidence, ad_performance_id FROM attribution WHERE order_id = ...`
  before treating it as a rendering/query bug.
- **"Reportadas" (Nivel 1/4, amber) looking high while real sales stay flat is
  probably a live-site tracking problem, not a dashboard bug** — confirmed
  2026-07-03: Meta's own `conversions_value` is `0.00` for every month of the
  entire 6-month history on both stores, and `lux_kids` shows an implausible
  volume relative to spend. Points to the Meta Pixel/Conversions API firing
  Purchase without a value on the live site (not fixable from this repo). Check
  `SELECT date_trunc('month', date), sum(conversions), sum(conversions_value)
  FROM ad_performance WHERE platform='meta' GROUP BY 1, store ORDER BY 1` before
  trusting "Reportadas" as a real signal.
- **Real Odoo order imports come back with `utm_campaign`/`utm_source` empty on
  every row** — confirmed on a real 80-order CSV, not a CSV/column-naming issue
  (the field names `Campaign/Campaign Name` / `Source/Source Name` are correct
  and already recognized). Root cause: Odoo's native UTM capture only fires on
  Odoo's own Website pages, and Abitare's real storefront is Locomotive/Elastic
  — that capture never triggers. Real fix is outside this repo (checkout needs
  to pass UTM params to Shopinvader explicitly). Save real sales CSVs under
  `imports/` (gitignored — they contain customer names/order totals) when
  importing, never commit them directly.
- **Dashboard's default date range ends *yesterday*, not today** — deliberate,
  so it matches what a human sees in Ads Manager (today's numbers are still
  accruing). If asked to compare a dashboard number against Ads Manager,
  confirm both are looking at the same closed date range before concluding
  there's a discrepancy.

See `CLAUDE.md` and `docs/architecture.md` for the full architecture and connector-level
gotchas (Meta Ads `time_increment`, Google Ads auth/library bugs, Postgres date
timezone parsing).
