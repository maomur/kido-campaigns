# Abitare Marketing Dashboard

Sistema backend + dashboard para integrar datos de Meta Ads, Google Ads y pedidos de
Odoo, cruzarlos mediante un motor de atribución, y calcular KPIs reales (ROAS, CPA,
AOV) por tienda, campaña, adset y anuncio para las tres tiendas del grupo Abitare
(Abitare Kids Barcelona, Abitare Kids Luxemburgo, Abitare Living Luxemburgo).

Ver [docs/architecture.md](docs/architecture.md) para el flujo completo del sistema y
[docs/odoo-custom-fields.md](docs/odoo-custom-fields.md) para la configuración
necesaria en Odoo.

## Estado actual

Fases 1-5 implementadas y validadas contra Postgres real y credenciales reales de
Meta Ads: tracking, conectores (Meta Ads en vivo; Google Ads y Odoo con conector
listo pero sin credenciales/acceso todavía — pedidos vía import CSV, ver más abajo),
ETL, motor de atribución, API REST (`/api/kpis/summary`, `/api/kpis/timeseries`,
`/api/campaigns`) y dashboard Next.js + Tremor con filtros, KPIs, gráfico temporal
y tabla de campañas. El scheduler (Fase 6) sigue como stub.

### Levantar el dashboard

```bash
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:3000
```

El frontend llama al backend vía `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Requisitos

- Node.js 20+ (probado con v24.14.1) y npm 10+.
- Docker Desktop, solo para levantar Postgres localmente (no instalado en este
  entorno de desarrollo — ver checklist más abajo).

## Setup

```bash
npm install
cp .env.example .env
```

Con `DRY_RUN=true` (valor por defecto en `.env.example`) se puede correr el pipeline
completo contra fixtures, sin tocar red real ni base de datos:

```bash
npm test               # 84 tests: fixtures, conectores, ETL, import CSV, atribucion, kpis
npm run test:integration  # 6 tests contra Postgres real (requiere docker:up + migrate) -- agregacion de api/queries.js
npm run etl:dry-run
npm run lint
```

## Próximos pasos (requieren Docker y/o credenciales reales)

1. Instalar Docker Desktop. ✅
2. `npm run docker:up` y esperar a que el healthcheck de Postgres pase. ✅
3. Ajustar `DATABASE_URL` en `.env` si es necesario (por defecto apunta al
   contenedor de `docker-compose.yml`). ✅
4. `npm run migrate` — aplica las migraciones (`ad_performance`, `orders`,
   `attribution`, `sync_log`, y el ajuste para import CSV). ✅
5. `npm run seed` (opcional) — carga datos de ejemplo para probar el dashboard
   cuando exista.
6. **Pedidos (Odoo)**: sin acceso de backend a Odoo (solo API Shopinvader
   scoped por tienda), la vía en uso es **CSV manual**, no la API en vivo:
   - Exporta desde Odoo (**Ventas → Pedidos → Exportar**), un archivo por
     tienda — ver columnas requeridas en `docs/architecture.md`.
   - `npm run import:sales -- --file=./ventas-bcn-kids.csv --store=bcn_kids`
     (repetir por tienda: `bcn_kids`, `lux_kids`, `lux_living`).
   - Si en el futuro se consigue acceso de backend a Odoo, `connectors/odoo.js`
     (XML-RPC) ya está implementado y listo para usarse en su lugar.
7. Con credenciales reales de Meta Ads / Google Ads en `.env`:
   `DRY_RUN=false npm run etl:run` (esto solo sincroniza `ad_performance`;
   los pedidos se cargan con `import:sales`, ver punto 6). ✅ Meta Ads
   (3 tiendas) validado con credenciales reales. Google Ads: pendiente de
   `GOOGLE_ADS_CLIENT_ID/SECRET/REFRESH_TOKEN/DEVELOPER_TOKEN`.
8. Revisar los resultados de `attribution/engine.js` corriendo contra datos
   reales ya persistidos antes de confiar en los KPIs. ✅
9. Fase 5 (API REST + dashboard) ✅ implementada. Pendiente: Fase 6
   (activar `scheduler/jobs.js`, alertas de ROAS por email/Slack).

## Estructura del monorepo

```
apps/
  backend/    Express API, conectores, ETL, motor de atribucion (npm workspace)
  frontend/   Next.js + Tremor: dashboard con KPIs, grafico temporal y campanas
db/           Migraciones y seeds de Knex.js
tests/        Fixtures y tests de Vitest
docs/         Documentacion de arquitectura y configuracion de Odoo
```
