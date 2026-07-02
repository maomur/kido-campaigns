# Campos de tracking en Odoo `sale.order`

> **Estado actual**: Abitare no tiene acceso de backend/admin a Odoo (el
> acceso es via un modulo Shopinvader personalizado, con API scoped por
> tienda/empresa para el storefront, no para lectura masiva de pedidos ni
> creacion de campos). Por eso, hoy se usa la via de **export/import manual de
> CSV** (`connectors/salesCsvImport.js`), que se apoya en los campos UTM
> **nativos** de Odoo (ver mas abajo) y no requiere nada de esta pagina. Esta
> tabla queda documentada para si en el futuro se consigue acceso de backend
> y se habilita `connectors/odoo.js` (XML-RPC) — ver `docs/architecture.md`.

Esto es configuracion a realizar directamente en la instancia de Odoo (via Studio
o un modulo custom), no codigo de este repositorio. El conector
`apps/backend/connectors/odoo.js` asume que estos campos ya existen y son
legibles via `search_read`.

## Lo que SÍ esta disponible hoy sin acceso especial

Odoo trae de fabrica el modulo `utm` (`utm.mixin`), heredado por `sale.order`,
con los campos `campaign_id` y `source_id` (many2one a `utm.campaign` /
`utm.source`). Se poblan automaticamente via cookies cuando la URL de llegada
trae `?utm_campaign=...&utm_source=...`, sin necesitar campos custom ni
permisos de admin. Son visibles en **Ventas → Pedidos → Exportar** como
"Campaña/Nombre de campaña" y "Origen/Nombre de la fuente" — esto es lo que
usa `connectors/salesCsvImport.js` hoy. No incluyen `medium`/`content`/`term`
ni click IDs.

## Campos a crear

| Campo (technical name) | Tipo    | Descripcion                                   |
|-------------------------|---------|------------------------------------------------|
| `utm_source`             | Char    | Fuente de trafico (ej. `facebook`, `google`)   |
| `utm_medium`             | Char    | Medio (ej. `cpc`, `organic`)                   |
| `utm_campaign`           | Char    | Nombre de campana                              |
| `utm_content`            | Char    | Variante de contenido/anuncio                  |
| `utm_term`               | Char    | Termino de busqueda (Google Ads)               |
| `fbclid`                 | Char    | Click ID de Meta Ads                           |
| `gclid`                  | Char    | Click ID de Google Ads                         |

`website_id` (many2one a `website`) ya existe de forma nativa en `sale.order`
via el modulo `website_sale` y se usa para distinguir la tienda de origen del
pedido (ver `ODOO_WEBSITE_STORE_MAP` en `.env.example`).

## Notas de comportamiento

- Odoo XML-RPC devuelve `false` (no `null` ni `''`) para campos `Char` vacios en
  `search_read`. El conector y `etl/transform.js` normalizan `false -> null`.
- `website_id` llega como tupla `[id, display_name]` (formato many2one estandar
  de Odoo). `mapWebsiteIdToStore()` en `connectors/odoo.js` extrae el `id` y lo
  resuelve a un `store` key usando `ODOO_WEBSITE_STORE_MAP`.

## Como capturar estos valores

El script `apps/frontend/public/tracking.js` captura los parametros de la URL
al aterrizar en el frontend Locomotive/Elastic, los persiste en
`sessionStorage`, y los inyecta como inputs ocultos en el formulario de
checkout para que viajen junto con la creacion del pedido en Odoo. Ver
`docs/architecture.md` para el flujo completo.
