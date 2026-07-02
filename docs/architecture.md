# Arquitectura

## Flujo end-to-end

1. **Captura de tracking** (`apps/frontend/public/tracking.js`): al aterrizar un
   usuario en el frontend Locomotive/Elastic de cualquiera de las 3 tiendas, el
   script captura `utm_*`/`fbclid`/`gclid` de la URL y los persiste en
   `sessionStorage`. Al llegar al checkout, los inyecta como campos ocultos en
   el formulario de pedido (ver `docs/odoo-custom-fields.md`) — esto alimenta
   los campos custom `fbclid`/`gclid` si en el futuro se habilita el acceso via
   API. Los campos `Campaña`/`Origen` que sí se usan hoy (ver mas abajo) los
   captura Odoo de forma nativa via cookies de sesion cuando la URL trae
   `?utm_campaign=...&utm_source=...`, sin depender de este script.

2. **Extraccion** (`apps/backend/etl/extract.js`): en paralelo (`Promise.allSettled`,
   un fallo en un conector no bloquea a los otros), se extraen:
   - `connectors/metaAds.js`: insights de campana de Meta Ads por cuenta publicitaria
     (una por tienda, via `META_AD_ACCOUNTS`).
   - `connectors/googleAds.js`: metricas GAQL de Google Ads por cuenta cliente
     (una por tienda, via `GOOGLE_ADS_CUSTOMER_ACCOUNTS`).
   - Pedidos de Odoo: ver "Fuente de datos de pedidos" mas abajo — hay dos vias,
     la API en vivo (`connectors/odoo.js`) o el import manual de CSV
     (`connectors/salesCsvImport.js`), segun el acceso disponible.

   Todos los conectores soportan `DRY_RUN=true`, devolviendo fixtures de
   `tests/fixtures/` en vez de llamar a la red real.

### Fuente de datos de pedidos: API en vivo vs CSV manual

El acceso de Abitare a Odoo es a traves de un modulo Shopinvader personalizado
que expone una API de ecommerce por tienda/empresa, sin acceso XML-RPC/admin
de proposito general. Por eso, en la practica se usa la via de **import
manual de CSV**, no la conexion automatica en vivo:

- **`connectors/odoo.js`** (via XML-RPC): implementado y testeado, pero
  requiere un usuario Odoo con acceso de backend a `sale.order` (no solo la
  API de storefront de Shopinvader) y los campos custom `fbclid`/`gclid`
  creados en el modelo. Se mantiene por si en el futuro se consigue ese
  acceso — habilita atribucion de **alta confianza** (clic directo).
- **`connectors/salesCsvImport.js`** (en uso actualmente): parsea un CSV
  exportado manualmente desde **Ventas → Pedidos → Exportar** en Odoo, un
  archivo por tienda/compania. Usa los campos UTM **nativos** de Odoo
  (`utm.mixin`: Campaña/Nombre de campaña, Origen/Nombre de la fuente), que
  no requieren crear ningun campo custom ni permisos de administrador —
  solo acceso de lectura a la vista de pedidos. Habilita atribucion de
  **confianza media** (por nombre de campaña) y **baja** (por plataforma de
  origen), pero no de alta confianza (no hay `fbclid`/`gclid` en el export).

  Columnas requeridas en el export: **Referencia del pedido**, **Fecha de
  pedido**, **Total**. Opcionales pero recomendadas: **Campaña/Nombre de
  campaña**, **Origen/Nombre de la fuente**, **Estado** (para filtrar
  presupuestos/cancelados; si no se incluye, filtrar antes de exportar en
  Odoo). El parser detecta el delimitador (`,` o `;`) automaticamente y
  acepta formato de importe europeo (`1.234,56`) o estandar (`1234.56`).

  Comando: `npm run import:sales -- --file=./ventas-bcn-kids.csv --store=bcn_kids`
  (una corrida por tienda). Como no hay ID interno de Odoo en el CSV, el
  upsert idempotente usa `(store, odoo_name)` como clave — ver migracion
  `20260701000005_alter_orders_for_csv_import.js`.

3. **Transformacion** (`apps/backend/etl/transform.js`): normaliza las 3 fuentes
   a las formas de `ad_performance` y `orders` (conversion de `cost_micros` a
   EUR, extraccion de `purchase` desde `actions`/`action_values` de Meta,
   resolucion de `website_id -> store`, normalizacion de `false -> null` de Odoo).

4. **Carga** (`apps/backend/etl/load.js`): upsert idempotente en PostgreSQL via
   Knex (`onConflict().merge()`), y registro de la sincronizacion en `sync_log`
   (usado para la extraccion incremental de pedidos Odoo en la siguiente corrida).

5. **Atribucion** (`apps/backend/attribution/engine.js`): para cada pedido sin
   atribucion previa (bajo el modelo `last_click` por defecto), clasifica su
   confianza y busca el `ad_performance` correspondiente:
   - **Alta** (`direct_click`): el pedido tiene `fbclid`/`gclid`. Match
     best-effort por plataforma + tienda + fecha cercana (la Insights API
     agregada no expone click IDs individuales).
   - **Media** (`utm_campaign`): coincidencia de `utm_campaign` contra
     `campaign_name` (case-insensitive).
   - **Baja** (`utm_source`): se reconoce la plataforma de origen
     (`facebook`/`google`/etc.) pero sin campana concreta;
     `ad_performance_id` queda `null`.
   - **Sin tracking**: no se inserta fila en `attribution` — se derivan como
     "sin atribuir" en reporting via `LEFT JOIN orders -> attribution`
     filtrando `attribution.id IS NULL`.

6. **KPIs** (`apps/backend/utils/kpis.js`): ROAS, CPA, AOV, CTR, CPC, CPM,
   calculados a partir de `orders`/`attribution`/`ad_performance` ya cruzados.

7. **API REST** (`apps/backend/api/`): `apps/backend/api/queries.js` agrega
   los datos ya cruzados:
   - `getSummaryKpis` -> `GET /api/kpis/summary?store=&platform=&from=&to=`
     (incluye `conversionRate = attributedOrders/clicks`, usado en el Nivel 6)
   - `getPlatformComparison` -> `GET /api/kpis/platform-comparison?store=&from=&to=`
     (spend/impressions/clicks/revenue/attributedOrders/cpa/roas por
     plataforma, solo plataformas con spend en el rango)
   - `getTimeseries` -> `GET /api/kpis/timeseries?store=&platform=&from=&to=&granularity=day|week`
     (gasto vs ingresos y roas por periodo; requiere que Meta se haya
     extraido con `time_increment=1`, ver nota mas abajo)
   - `getSpendBreakdown` -> `GET /api/kpis/breakdown?store=&from=&to=`
   - `getCampaigns` -> `GET /api/campaigns?store=&platform=&from=&to=` (incluye
     `cpa` por campana)

   `/api/orders` sigue como stub (Fase 6).

8. **Dashboard** (`apps/frontend/app/page.jsx`): Next.js + Tremor, cliente que
   llama a la API de arriba. Filtros por tienda, plataforma y rango de fechas;
   una sola pantalla apilada con 5 niveles de informacion (Nivel 5 -- funnel --
   y beneficio estimado quedaron fuera de alcance, a construir despues). Ver
   la tabla completa de niveles -> componente -> ruta API en `CLAUDE.md` (seccion
   "Dashboard structure (Niveles)"). `NEXT_PUBLIC_API_URL` apunta al backend
   (default `http://localhost:3001`).

9. **Orquestacion**: `apps/backend/etl/pipeline.js` ejecuta extract -> transform
   -> load -> attribution, respetando `DRY_RUN`. El scheduler
   (`apps/backend/scheduler/jobs.js`, Fase 6) lo dispara diariamente via
   `node-cron`.

### Notas de implementacion (Fase 5)

- **`matchByCampaignName` no filtraba por tienda (bug real, corregido)**: a
  diferencia de `matchByClickId`/`matchByPlatformOnly`, buscaba el
  `campaign_name` en `ad_performance` de *todas* las tiendas, no solo la del
  pedido. Nombres de campana estacionales se repiten entre tiendas (ej.
  "Soldes d'ete 2026" existe igual en `lux_kids` y `lux_living`), asi que un
  pedido podia atribuirse a la campana de otra tienda. Corregido agregando
  `row.store === order.store` al filtro — ver test "does not match a campaign
  belonging to a different store" en `tests/attribution/engine.test.js`.
- **`getCampaigns` cruzaba ingresos por `campaign_id` solo, sin tienda/plataforma
  (bug real, corregido)**: igual que el problema de duplicados de
  `ad_performance` (ver mas abajo), el `campaign_id` de Google Ads no es unico
  globalmente. El mapa de ingresos atribuidos por campana usaba solo
  `campaign_id` como clave; si dos tiendas tuvieran el mismo `campaign_id` (no
  ha pasado aun, verificado con `SELECT campaign_id, count(DISTINCT store)...
  HAVING count(DISTINCT store) > 1`), el ingreso de una tienda se mostraria
  tambien en la otra. Corregido usando `(platform, store, campaign_id)` como
  clave. Cubierto por test de integracion en `tests/api/queries.test.js`.
- **`attribution.model` no se filtraba explicitamente en los JOIN de
  `queries.js`**: hoy solo existe el modelo `last_click`, asi que no era un
  bug activo, pero un JOIN `orders -> attribution` sin filtrar por modelo
  cuenta el mismo pedido una vez por cada fila de atribucion que tenga (una
  por modelo). Se agrego el filtro explicito (`ATTRIBUTION_MODEL` constante)
  para que agregar un segundo modelo en el futuro no infle ingresos
  atribuidos silenciosamente.
- **Tests de integracion contra Postgres real** (`tests/api/queries.test.js`,
  `npm run test:integration`): `api/queries.js` (agregaciones SQL con JOINs)
  no tenia cobertura automatizada — solo se habia verificado manualmente por
  curl. Corren en una transaccion que se revierte al final (no tocan datos
  reales), y estan excluidos de `npm test` por defecto (`vitest.config.js`
  `exclude`) porque requieren Postgres real corriendo.
- **Cargas historicas largas (varios meses, `time_increment=1`) fallan
  transitoriamente en Meta con codigos 1 ("Unknown error") y 2 ("Service
  temporarily unavailable")**, ademas de los codigos de rate limit ya
  cubiertos (4, 17, 32, 613). `RATE_LIMIT_CODES` en `connectors/metaAds.js`
  ahora incluye 1 y 2. Tambien conviene **no pedir las 3 cuentas de una
  tienda en paralelo para rangos largos** (`fetchAllStoresMetaInsights`
  llama `Promise.allSettled` en paralelo) — si varias cuentas piden 6 meses
  de desglose diario a la vez, es mas facil que Meta empiece a devolver
  estos errores transitorios. Para cargas historicas grandes, considerar
  cargar cuenta por cuenta de forma secuencial.
- **NULL en `adset_id`/`ad_id` rompe el upsert idempotente de `ad_performance`**:
  Meta con `level='campaign'` no devuelve `adset_id`/`ad_id` (solo existen a nivel
  de anuncio). Postgres nunca considera dos `NULL` iguales en un indice unico, asi
  que el `unique(['platform','store','campaign_id','adset_id','ad_id','date'])`
  nunca detectaba conflicto para esas filas — cada corrida del pipeline insertaba
  filas nuevas en vez de actualizar, triplicando (o mas) spend/impressions/reach/
  todo, sin lanzar ningun error. Se detecto porque el "Alcance" del dashboard se
  veia implausiblemente alto. Fix en `etl/transform.js#transformMetaRow`:
  `adset_id: rawRow.adset_id || ''` (string vacio, no `null`/`undefined`) — ver
  test `transformMetaRow defaults adset_id/ad_id to ""` en `tests/etl/transform.test.js`.
  Si se sospecha de nuevo de datos inflados, verificar con:
  `SELECT platform, count(*), count(DISTINCT (store,campaign_id,adset_id,ad_id,date)) FROM ad_performance GROUP BY platform;`
  (si no coinciden, hay duplicados).
- **`google-ads-api` (v24.1.0) rompe al reportar errores reales**: cuando la
  API de Google Ads devuelve un error con `details[]` (formato estandar de
  error de Google, ej. `PERMISSION_DENIED`/`SERVICE_DISABLED`), la libreria
  `google-ads-api` falla al decodificarlo (`Cannot read properties of
  undefined (reading 'get')`, precedido de warnings `No data type found for
  ...`), ocultando el mensaje real tanto en `customer.query()` (gRPC) como en
  `customer.search()` (REST). Para depurar errores reales de Google Ads,
  saltarse la libreria y llamar directo a
  `https://googleads.googleapis.com/v24/customers/{id}/googleAds:search` con
  `fetch` (headers `Authorization: Bearer {access_token}`, `developer-token`,
  `login-customer-id`) — ahi si se ve el JSON de error completo sin filtrar.
- **`fetchAllStores*({...})` debe usar `Promise.allSettled`, no `Promise.all`**:
  si una tienda/cuenta falla (ej. permisos), `Promise.all` descarta los datos
  ya obtenidos de las demas tiendas que si funcionaron. Corregido en
  `connectors/metaAds.js` y `connectors/googleAds.js` — cada tienda se procesa
  de forma independiente y solo la que falla se omite (con log de error).
- **`GOOGLE_ADS_LOGIN_CUSTOMER_ID` + refresh token deben ser de la misma
  cuenta de Google Ads**: el Developer Token pertenece a una cuenta/MCC
  especifica; el refresh token OAuth debe generarse autorizando con un
  usuario que tenga acceso API a esa misma jerarquia. Autorizar con una
  cuenta distinta (aunque vea las mismas cuentas publicitarias en la UI de
  Google Ads) produce `USER_PERMISSION_DENIED` en todas las consultas.
- **`time_increment=1` en `connectors/metaAds.js`**: sin este parametro, la
  Insights API de Meta devuelve una sola fila por campana agregando *todo* el
  rango de fechas pedido (util para el resumen, inutil para un grafico
  temporal diario). Se pide desglose diario siempre.
- **Zona horaria de columnas `DATE` en Postgres** (`apps/backend/db.js`): el
  driver `pg` parsea `DATE` en hora local del proceso, no UTC. En un servidor
  UTC+2 (España/Luxemburgo), `'2026-06-01'` se leia como `'2026-05-31'` al
  pasar por `toISOString()`. Se sobreescribe el parser del OID 1082 para
  devolver el string tal cual.
- **`@tremor/react` hoisted a la raiz del monorepo**: en `apps/frontend/tailwind.config.cjs`,
  el `content` que apunta a los componentes de Tremor debe ser
  `../../node_modules/@tremor/**` (no `./node_modules/@tremor/**`), porque
  npm workspaces hoistea el paquete a la raiz. Si el dashboard se ve sin
  estilos (cards sin borde, iconos gigantes, graficos deformados), es este
  problema — Tailwind nunca escaneo el codigo fuente de Tremor.
- **Safelist de colores: `fill`/`stroke`, no solo `bg`/`text`/`border`/`ring`**:
  `AreaChart` pinta con gradientes SVG inline (no depende de Tailwind), pero
  `DonutChart`/`BarChart` de Tremor construyen clases `fill-{color}-500`
  dinamicamente, que el scanner estatico de contenido de Tailwind no puede
  detectar. Si un donut/barra sale en negro en vez del color pedido, revisar
  que el `safelist` de `tailwind.config.cjs` incluya el prefijo `fill` (y
  `stroke`) ademas de `bg|text|border|ring`.
- **`reach` (Alcance) sumado por dia es una aproximacion**: al pedir
  `time_increment=1` para el grafico temporal, el "alcance" de Meta ya viene
  por dia; sumarlo para un rango de varias semanas sobreestima el alcance
  unico real (la misma persona puede contarse en varios dias). Aceptable como
  aproximacion para el dashboard, no es alcance deduplicado exacto.
- **El total de ingresos/compras del Nivel 1 (vision ejecutiva) puede no
  coincidir con la suma del Nivel 2/4 (por plataforma/campana) -- esperado, no
  es un bug**: `getSummaryKpis` cuenta *cualquier* fila de `attribution`
  (incluida confianza baja, o media con match de nombre fallido -- ver nota en
  `CLAUDE.md`), mientras que `getPlatformComparison`/`getCampaigns` solo pueden
  atribuir ingreso a una plataforma/campana concreta cuando `ad_performance_id`
  no es null. Con pocos pedidos importados via CSV es facil ver el Nivel 1 con
  ingreso real y el Nivel 2/4 en 0 para el mismo rango -- verificar con
  `SELECT confidence, ad_performance_id FROM attribution WHERE order_id = ...`
  antes de asumir que es un bug de visualizacion.
- **`USER_PERMISSION_DENIED` de Google Ads puede ser simplemente IDs de cuenta
  incorrectos, no un problema de permisos real**: los IDs de `lux_kids`/
  `lux_living` en `.env` se habian copiado del selector de cuentas visible en
  la sesion personal de Google del usuario, que mostraba cuentas con nombres
  parecidos ("Abitare Kids LU", "Abitare Living LU") pero que **no eran** las
  mismas cuentas administradas por la MCC del developer token. Se resolvio
  consultando la MCC directamente:
  `SELECT customer_client.id, customer_client.descriptive_name FROM customer_client`
  contra `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, que lista los IDs reales de las
  cuentas cliente — deben coincidir exactamente con los guardados en
  `GOOGLE_ADS_CUSTOMER_ACCOUNTS`. Tras corregir los IDs, `lux_kids` tiene una
  sola campana breve (marzo 2026) y `lux_living` no tiene actividad en Google
  Ads en el rango sincronizado — ambos son datos reales, no errores.

## Estado de implementacion

| Componente                          | Estado                                    |
|--------------------------------------|--------------------------------------------|
| Tracking (frontend + Odoo)           | Implementado                                |
| Conectores Meta/Google Ads           | Implementado (dry-run + tests)              |
| Conector Odoo XML-RPC                | Implementado, sin usar (falta acceso backend) |
| Import CSV de pedidos (en uso)       | Implementado (tests + validado con Postgres real) |
| Base de datos / ETL                  | Implementado (dry-run + tests)              |
| Motor de atribucion                  | Implementado (tests, validado con Postgres real) |
| Meta Ads: conexion real               | Implementado y validado (credenciales reales, 3 tiendas) |
| Google Ads: conexion real             | Implementado y validado (credenciales reales, 3 tiendas) |
| API REST — summary/platform-comparison/timeseries/breakdown/campaigns | Implementado, validado con datos reales |
| API REST — orders/conversions        | Stub (Fase 6)                               |
| Dashboard (`apps/frontend/app/`)     | Implementado: Niveles 1-4 y 6 (vision ejecutiva, comparativa de canal, evolucion, campanas paginadas, diagnostico). Nivel 5 (funnel) y beneficio estimado fuera de alcance |
| Scheduler / alertas                  | Stub (Fase 6)                               |

Ver el checklist de proximos pasos (Docker, credenciales reales) en el
`README.md` de la raiz del repo.
