# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Abitare Marketing Dashboard: integrates Meta Ads, Google Ads and Odoo order data for
three ecommerce stores (Abitare Kids Barcelona, Abitare Kids Luxembourg, Abitare
Living Luxembourg), cross-references ad spend with real confirmed orders via an
attribution engine, and serves real KPIs (ROAS, CPA, AOV, CTR, CPC, CPM) through a
REST API and a Next.js + Tremor dashboard. npm workspaces monorepo, ESM throughout
(`"type": "module"`).

## Commands

```bash
# Setup
npm install
cp .env.example .env          # then fill in credentials (see docs/architecture.md)
npm run docker:up             # starts Postgres (docker-compose.yml)
npm run migrate               # applies db/migrations/*
npm run seed                  # optional example data

# Testing / linting
npm test                      # vitest run (all tests, mocked, no Postgres needed)
npx vitest run tests/etl/pipeline.test.js   # single file
npx vitest run -t "test name substring"     # single test by name
npm run test:integration      # api/queries.js SQL aggregation tests against real Postgres (needs docker:up + migrate)
npm run lint                  # eslint .

# ETL
npm run etl:dry-run           # DRY_RUN pipeline against fixtures, no network/DB writes
npm run etl:run               # real run: extract -> transform -> load -> attribution
npm run import:sales -- --file=./ventas.csv --store=bcn_kids   # manual order import (see below)

# Dev servers
npm run dev:backend           # Express API on :3001
npm run dev:frontend          # Next.js dashboard on :3000 (calls NEXT_PUBLIC_API_URL)
```

Store keys used throughout the codebase (env vars, `orders.store`, `ad_performance.store`):
`bcn_kids`, `lux_kids`, `lux_living`.

### Real-credentials status (as of 2026-07-02)

- **Meta Ads**: connected, loading real 6-month history for all 3 stores.
- **Google Ads**: connected for all 3 stores. `lux_kids`/`lux_living` were
  initially `USER_PERMISSION_DENIED` — root cause was **wrong customer IDs in
  `.env`** (copied from a personal Google account's account selector, which
  showed similarly-named but different accounts), not an actual access
  problem. Fixed by querying `customer_client` on the manager account
  (`GOOGLE_ADS_LOGIN_CUSTOMER_ID`) to get the real child-account IDs. If a
  Google Ads ID mismatch is suspected again, query
  `SELECT customer_client.id, customer_client.descriptive_name FROM customer_client`
  against the login customer ID to list the true managed accounts. Google Ads
  spend is real but low/sparse for `lux_kids` (one short March campaign) and
  `lux_living` (no activity in the synced range) — that's real business data,
  not a bug.
- **Odoo**: no backend access; orders come from manual CSV import only (see
  below). `.env` has all credential slots — check `GOOGLE_ADS_*`/`META_*` are
  actually filled before assuming dry-run/fixture mode.

## Architecture

### Data flow

`connectors/` (Meta Ads, Google Ads, Odoo/CSV) → `etl/transform.js` (normalize to
`ad_performance` / `orders` shape) → `etl/load.js` (idempotent upsert into Postgres) →
`attribution/engine.js` (cross-references orders with ad_performance) →
`api/queries.js` (aggregation) → `api/routes/*` → Next.js dashboard.

`etl/pipeline.js` orchestrates extract → transform → load → attribution end to end,
gated by `DRY_RUN`. `etl/extract.js` runs the three connectors with
`Promise.allSettled` so one connector's failure doesn't block the others — the same
pattern is required *inside* each connector's `fetchAllStores*` function (one store/
account failing must not discard data already fetched from the other stores; see the
`Promise.allSettled` note in `docs/architecture.md`).

### Order data has two independent paths — CSV is the one in use

Abitare's Odoo access is via a Shopinvader module scoped per store/company, not a
general backend/XML-RPC account. Because of that:
- `connectors/odoo.js` (XML-RPC) is fully implemented and tested but **not
  currently usable** — kept in case backend access is granted later. It's the only
  path that can populate `fbclid`/`gclid` for high-confidence attribution.
- `connectors/salesCsvImport.js` (**in use**) parses a manually-exported CSV from
  Odoo's Sales list view, one file per store, run via `npm run import:sales`. It
  relies on Odoo's native `utm.mixin` fields (Campaign/Source — visible in the
  export without any custom fields or admin access), which only support
  medium/low-confidence attribution, not direct-click.
- Because of this, `orders` upserts key on `(store, odoo_name)`, not `odoo_id`
  (CSV imports have no Odoo internal ID) — see migration
  `20260701000005_alter_orders_for_csv_import.js`.

### Attribution confidence tiers (`attribution/engine.js`)

Orders without an existing `attribution` row (per `model`, default `last_click`) are
classified in priority order: `fbclid`/`gclid` present → **high** (`direct_click`,
best-effort match by platform+store+nearby date, since aggregated Insights APIs don't
expose individual click IDs); `utm_campaign` present → **medium** (matched
case-insensitively against `ad_performance.campaign_name`, **scoped to the order's
own `store`** — campaign names repeat across stores (seasonal campaigns like "Soldes
d'ete 2026" exist under multiple Luxembourg stores), so matching without a store
filter can attribute an order to a different store's campaign); `utm_source` present
only → **low** (`ad_performance_id` is always left `null` — deliberately, never
resolved via `matchByPlatformOnly` even when a candidate row exists — the row only
signals "some tracking, no attributable campaign"); no tracking at all → **no row is
inserted** (organic orders are derived at query time via `LEFT JOIN orders ->
attribution ... WHERE attribution.id IS NULL`, not stored explicitly).

**`campaign_id` is not globally unique** (Google Ads IDs are unique only within an
account/store, same issue as the `ad_performance` unique index below). Any code that
aggregates or joins on `campaign_id` alone — without `store`/`platform` — risks mixing
data across stores. `api/queries.js#getCampaigns` learned this the hard way (fixed:
now keys its revenue-by-campaign map on `platform:store:campaign_id`).

**Medium-confidence attribution rows can still end up with `ad_performance_id =
null`**: `matchByCampaignName` only sets `ad_performance_id` when the order's
`utm_campaign` string matches a real `ad_performance.campaign_name` exactly
(case-insensitive). If the marketing team's UTM naming drifts from the actual
Meta/Google campaign name (real example: order UTM `"BCN Kids - Verano 2026"` vs.
actual campaign `"Rebajas Verano 2026 - General - BCN"`), the attribution row is
still inserted (confidence stays `medium`) but with a `null` `ad_performance_id` —
same as the "low confidence" case. This is not a bug, just worth knowing when
sanity-checking numbers (see the Nivel 1 vs. Nivel 2/4 gotcha below).

### Dashboard structure (Niveles)

`apps/frontend/app/page.jsx` renders a single stacked page, in this order (a "Nivel
5" funnel and a profit/margin level were scoped out for later — not built):

| Nivel | Contenido | Componente | Ruta API |
|-------|-----------|------------|----------|
| 1 — Visión ejecutiva | Gasto, Ingresos atribuidos, ROAS, Compras, CPA, Ticket medio | `ExecutiveKpiCards.jsx` | `GET /api/kpis/summary` |
| 2 — Comparativa de canal | Meta Ads vs Google Ads (spend/revenue/CPA/ROAS) + donuts por tienda/plataforma | `PlatformComparisonTable.jsx`, `SpendBreakdownCharts.jsx` | `GET /api/kpis/platform-comparison`, `GET /api/kpis/breakdown` |
| 3 — Evolución temporal | Gasto vs. ingresos y ROAS por día/semana (toggle) | `EvolutionCharts.jsx` | `GET /api/kpis/timeseries?granularity=day\|week` |
| 4 — Campañas | Ranking de campañas: Campaña / Plataforma / Tienda / Gasto / Ingresos / Compras / CPA / ROAS, paginado client-side a 20 filas | `CampaignsTable.jsx` | `GET /api/campaigns` |
| 6 — Diagnóstico | CTR, CPC, CPM, Frecuencia, Tasa de conversión (calidad de anuncio, no resultado de negocio) | `DiagnosticKpiCards.jsx` | `GET /api/kpis/summary` (reuses the same payload as Nivel 1) |

**Nivel 1's revenue/compras total will not always match the sum of Nivel 2/4's
revenue/compras** — this is expected, not a bug. Nivel 1 (`getSummaryKpis`) counts
*every* `attribution` row regardless of confidence, including rows with `null`
`ad_performance_id` (low confidence, or medium confidence with a failed name match —
see above). Nivel 2 (`getPlatformComparison`) and Nivel 4 (`getCampaigns`) can only
attribute revenue to a platform/campaign when `ad_performance_id` is set, since that's
the only link to a specific platform/campaign row. With a small CSV-imported order
sample, it's common to see Nivel 1 show real attributed revenue while Nivel 2/4 show
0 — check `SELECT confidence, ad_performance_id FROM attribution WHERE order_id = ...`
before assuming it's a display bug.

### Known gotchas (see full detail in `docs/architecture.md`)

- **`ad_performance` NULL `adset_id`/`ad_id` silently breaks upsert idempotency.**
  Meta's `level='campaign'` fetch has no adset/ad granularity, so those columns are
  `null` — and Postgres never treats two `NULL`s as equal in a unique index, so the
  `onConflict` upsert in `etl/load.js` never matched, quietly *inserting duplicate
  rows on every pipeline run* (3x+ inflated spend/impressions/reach, no error
  thrown). `etl/transform.js#transformMetaRow` uses `rawRow.adset_id || ''` (empty
  string, not null) to keep the unique index meaningful. If dashboard numbers look
  implausibly high, check for duplicates: `SELECT platform, count(*), count(DISTINCT
  (store,campaign_id,adset_id,ad_id,date)) FROM ad_performance GROUP BY platform;`
  — mismatched counts mean duplicates.
- `google-ads-api` (npm, v24.1.0) throws an opaque `Cannot read properties of
  undefined (reading 'get')` instead of surfacing real Google Ads API errors. To
  debug, bypass the library and call
  `https://googleads.googleapis.com/v24/customers/{id}/googleAds:search` directly
  with `fetch`.
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` and the OAuth refresh token must come from the
  *same* Google Ads account hierarchy as the developer token, or every call fails
  with `USER_PERMISSION_DENIED` even though the UI account selector may show the
  same accounts as accessible.
- Meta Ads insights must be fetched with `time_increment=1`; without it, Meta
  returns one aggregated row per campaign for the whole requested range instead of
  daily rows, which breaks the timeseries chart.
- Multi-month historical Meta fetches (`time_increment=1` over 3-6 months) hit
  transient Meta errors (`code: 1` "Unknown error", `code: 2` "Service
  temporarily unavailable") more often than short ranges, especially when
  several stores/accounts are fetched in parallel via
  `fetchAllStoresMetaInsights`'s `Promise.allSettled`. Both codes are now in
  `RATE_LIMIT_CODES` (retried automatically), but for large backfills it's
  still more reliable to load accounts one at a time sequentially rather than
  all at once.
- Postgres `DATE` columns are parsed by `pg` in local time, not UTC — on a UTC+2
  server this silently shifts dates back a day via `toISOString()`. `db.js`
  overrides the type parser for OID 1082 to return the raw string.
- In `apps/frontend/tailwind.config.cjs`, the Tailwind `content` glob for
  `@tremor/react` must point at the *root* `node_modules` (`../../node_modules/@tremor/**`),
  not `apps/frontend/node_modules`, because npm workspaces hoists the package.
  Tremor's donut/bar charts also need `fill`/`stroke` color prefixes in the
  safelist (not just `bg`/`text`/`border`/`ring`), since those classes are built
  dynamically and Tailwind's static scanner can't detect them.

## KPI/metric conventions

All KPI formulas live in `apps/backend/utils/kpis.js` and always return `Number`
(rounded to 2 decimals), never a formatted string — formatting happens at the
frontend edge. `ad_performance.reach` (used for Frequency = impressions/reach) is a
sum of daily reach values when fetched with `time_increment=1`, which overstates true
deduplicated reach across a multi-day range — treated as an accepted approximation,
not exact. `calculateConversionRate(orders, clicks)` (Nivel 6) is `attributedOrders /
clicks`, not `totalOrders / clicks` — it only counts orders actually tied to an
attribution row, consistent with how CPA/ROAS are computed elsewhere.
