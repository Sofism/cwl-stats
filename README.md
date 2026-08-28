# CWL Stats Tracker

App para llevar las estadísticas de Clan War League (CWL) de dos clanes de
Clash of Clans, temporada a temporada, con histórico entre temporadas y
reparto de bonuses de liga.

## Arquitectura

Son **dos repos separados**:

1. **Este repo** (`cwl-stats`) — el frontend en React, alojado en Vercel.
   Incluye también las funciones serverless de `/api` para guardar/leer las
   temporadas en Redis.
2. **`coc-proxy`** (repo aparte, alojado en Render) — un proxy Express muy
   simple que reenvía peticiones a `https://api.clashofclans.com/v1/...`
   añadiendo el token de la API. Es imprescindible porque la API oficial de
   Clash of Clans exige que la IP que llama esté en una whitelist y no
   permite peticiones directas desde el navegador (CORS). Render le da a
   este proxy una IP fija que se whitelistea una vez en el
   [portal de desarrolladores de Supercell](https://developer.clashofclans.com/).
   El proxy expone `GET /ip` para comprobar cuál es esa IP.

```
Navegador (React) → coc-proxy (Render) → api.clashofclans.com
                  ↘ /api/* (Vercel)   → Redis (guardado de temporadas)
```

## Estructura de carpetas

```
src/
├── App.js                    # Enrutado principal: selector → import → dashboard
├── components/
│   ├── SeasonSelector.jsx    # Pantalla de inicio: elegir/crear temporada
│   ├── ImportView.jsx        # Sincronizar desde la API (o pegar manual como respaldo)
│   ├── Dashboard.jsx         # Vista principal con las stats de la temporada activa
│   ├── StatsTable.jsx        # Tabla de jugadores (memoizada)
│   ├── StatsCards.jsx        # Tarjetas resumen
│   ├── ClanTabs.jsx          # Pestaña clan principal / secundario
│   ├── ColumnSelector.jsx    # Mostrar/ocultar columnas de la tabla
│   ├── LeagueSettings.jsx    # Liga, posición, guerras ganadas, tamaño de guerra
│   ├── SeasonList.jsx        # Lista de temporadas guardadas
│   ├── HistoricalView.jsx    # Histórico entre temporadas + evolución por jugador
│   ├── PlayerBarChart.jsx / PlayerLineChart.jsx  # Gráficos (recharts)
│   ├── PlayerModal.jsx       # Detalle de un jugador (lazy loaded)
│   ├── NewSeasonModal.jsx / DeleteConfirmModal.jsx
│   └── SettingsModal.js      # Nombres y tags de los clanes
├── hooks/
│   ├── useSeasons.js         # Estado de temporadas + guardado en /api
│   └── useClanNames.js       # Nombres/tags de los clanes (localStorage)
├── utils/
│   ├── cocApi.js             # Llamadas al proxy de la API de Clash of Clans
│   ├── cwlSync.js            # Agrega los datos de la API en stats por jugador
│   ├── bonusCalculator.js    # Cálculo de bonuses de liga (ver más abajo)
│   ├── dataParser.js         # Parser del pegado manual (respaldo si la API falla)
│   ├── shareUtils.js         # Generar/leer enlaces para compartir
│   └── constants.js          # Ligas, valores de medalla, columnas por defecto
└── api/
    ├── save-season.js / get-seasons.js / delete-season.js   # CRUD de temporadas (Redis)
    ├── share.js / get-share.js                              # Enlaces compartidos
    └── redis.js                                             # Cliente Redis (Vercel KV o Upstash)
```

## Sincronización con la API del juego

`ImportView` sincroniza los dos clanes con un botón. Por debajo:

1. `cocApi.js` pide al proxy el grupo de CWL actual del clan
   (`clans/{tag}/currentwar/leaguegroup`) y, para cada guerra del grupo que
   nos toca a nosotros, el detalle de esa guerra
   (`clanwarleagues/wars/{warTag}`).
2. `cwlSync.js` agrega esos datos por jugador (usando el **tag** del
   jugador como clave, no el nombre) y calcula: estrellas/destrucción de
   ataque y defensa, ataques fallados, tasa de 3 estrellas, y el
   `avgDistance` (media de "posición propia - posición del objetivo" en el
   mapa de guerra de cada ataque; confirmado con la definición del bot
   original: jugador en la posición 5 atacando en 20/25/30 → media -20).
3. También calcula automáticamente: liga actual, guerras ganadas, tamaño
   de guerra (5v5/15v15/30v30, lo trae directamente `teamSize` de la
   guerra) y la posición final dentro del grupo (clasificando los 8 clanes
   por guerras ganadas → estrellas → destrucción).

Si el pegado manual desde Excel/Sheets hace falta como respaldo (la API
falla, el clan no está en CWL en ese momento, temporadas antiguas, etc.),
sigue disponible colapsado bajo "Pegar datos manualmente".

### Sobre el "merge de jugadores" y "active members" que había antes

Ya no existen como paneles manuales:

- **Antes**: unificar el histórico de un jugador que cambió de nombre
  requería un merge manual, porque solo se guardaba el nombre.
- **Ahora**: cada jugador sincronizado desde la API lleva su `tag` (estable
  aunque cambie el nombre), así que `HistoricalView` agrupa por tag
  automáticamente. Las temporadas antiguas importadas a mano (sin tag)
  siguen agrupándose por nombre como respaldo — si alguien cambió de
  nombre en esas temporadas antiguas, aparecerá como dos jugadores, pero
  cualquier temporada sincronizada desde la API a partir de ahora no
  tendrá ese problema.
- **Activo/inactivo**: ya no es una lista pegada a mano. `HistoricalView`
  consulta en vivo `getClanMembers` con los tags configurados en Ajustes y
  marca como activo a quien esté en el roster actual.

## Cálculo de bonuses (`utils/bonusCalculator.js`)

La regla oficial de Clash of Clans: el líder tiene un número base de
bonuses según la liga, +1 por cada guerra ganada. Antes, el código nunca
usaba el **tamaño de guerra** (no se guardaba en ningún sitio) ni la
**posición final** (se pedía pero no afectaba a nada).

- `calculateBonusSlots({ league, warsWon, warSize })` — 15v15 y 30v30
  reparten el mismo número de bonuses (solo cambia entre cuántos
  jugadores se reparten); 5v5 usa una tabla base más pequeña.
- `calculateMedalValue({ league, position })` — el valor de cada medalla
  de bono se reduce progresivamente cuanto peor es la posición final.

**Importante:** las tablas exactas para 5v5 y la caída de valor por
posición son una aproximación a partir de fuentes públicas, no una tabla
oficial verificada. Si comparas con una temporada real y el número no
coincide con lo que muestra el juego, con darme el caso concreto (liga +
tamaño de guerra + guerras ganadas + bono real) se recalibra la tabla.

## Variables de entorno

**Este repo (Vercel):**
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV) — o —
  `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Upstash directo)
- `REACT_APP_COC_PROXY_URL` — URL base del proxy en Render (sin `/api/coc`
  al final, eso ya lo añade el código)
- `REACT_APP_COC_PROXY_SECRET` — debe coincidir con `PROXY_SECRET` del
  proxy (ver abajo). Si se deja vacío, el proxy sigue funcionando sin
  cabecera (modo abierto).

**Repo `coc-proxy` (Render):**
- `COC_API_TOKEN` — token de la API de Clash of Clans, con la IP del
  servicio de Render whitelisteada en developer.clashofclans.com (usa
  `GET /ip` en el proxy para saber cuál es)
- `PROXY_SECRET` — cadena que solo conocéis vosotros; el proxy rechaza con
  401 cualquier petición a `/api/coc` que no la lleve en la cabecera
  `x-proxy-secret`. Frena el abuso casual (bots que escanean proxies CORS
  abiertos), pero **no es un secreto real**: al ser una app 100% frontend,
  `REACT_APP_COC_PROXY_SECRET` queda embebido en el JS que se descarga el
  navegador, así que alguien que inspeccione la pestaña de red de la app
  podría copiarlo. Si algún día hace falta más que eso, la solución es
  mover estas llamadas a una función serverless propia en `/api` que
  guarde el token del lado servidor en vez de llamar al proxy de Render
  directamente desde el navegador.

## Desarrollo local

```bash
npm install
npm start      # servidor de desarrollo
npm run build  # build de producción
```

## Tema visual

Paleta y tipografía personalizadas vía config de Tailwind (CDN) en
`public/index.html`: grafito cálido (`void`), texto tipo pergamino
(`ink`), acento teal para el clan principal (`signal`) y acento azul
grisáceo para el secundario (`steel`). Tipografía: Barlow Condensed
(títulos) + Inter (cuerpo) + IBM Plex Mono (datos numéricos).
