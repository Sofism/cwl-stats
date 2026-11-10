# CLAUDE.md — Contexto del proyecto CWL Stats Tracker

Este archivo lo lee Claude Code automáticamente. Recoge decisiones,
convenciones y límites descubiertos que no son evidentes leyendo el código.

---

## Qué es

App para llevar estadísticas de Clan War League (CWL) de Clash of Clans de
dos clanes: **True North** (principal) y **DD** (secundario). Sustituye un
flujo manual anterior en el que se pegaban datos de un bot desde una hoja
de cálculo.

Tags: True North `#PQQGGJYQ`, DD `#2LL8C8Y2Q`. Se guardan en Redis vía
`api/clan-config.js`, editables desde Ajustes. (Hubo un bug por un punto
final pegado al tag; `normalizeTag()` ya limpia puntuación.)

El propietario (Santi) lidera ambos clanes. Habla español; **la interfaz va
íntegramente en inglés** (ya se coló español dos veces, verificar siempre).

## Arquitectura: dos repos

1. **`cwl-stats`** (este) — React 18 + CRA, desplegado en **Vercel**.
   Incluye funciones serverless en `/api` que persisten en **Redis**
   (Upstash o Vercel KV, se detecta por variables de entorno).
2. **`coc-proxy`** — Express en **Render**, URL:
   `https://coc-proxy-oh0q.onrender.com`. Reenvía a
   `api.clashofclans.com/v1/` añadiendo el token. Es imprescindible: la API
   de Supercell exige IP whitelisteada y no permite CORS desde navegador.
   Expone `GET /ip` para consultar la IP a whitelistear.
   **Valida la cabecera `x-proxy-secret`** contra `PROXY_SECRET`; si esa
   variable no está puesta, el proxy queda abierto (modo compatible).
   **Render en plan gratuito duerme el servicio** tras ~15 min sin tráfico:
   la primera petición tarda 30-60 s en despertar. Esto es crítico para el
   cron (ver más abajo) y explica fallos intermitentes del primer sync.

```
Navegador → coc-proxy (Render, IP fija) → api.clashofclans.com
          → /api/* (Vercel) → Redis
```

### Variables de entorno

Vercel: `REACT_APP_COC_PROXY_URL` (sin barra final, sin `/api/coc`),
`REACT_APP_COC_PROXY_SECRET`, más las de Redis.
Render: `COC_API_TOKEN`, `PROXY_SECRET`.

**Aviso conocido:** `REACT_APP_COC_PROXY_SECRET` va embebido en el bundle
del cliente, así que es visible para cualquiera que mire la pestaña de red.
Frena abuso casual, no es seguridad real. La solución definitiva es mover
las llamadas a una función serverless propia (ver "Cron" más abajo).

**Aviso 2:** las variables `REACT_APP_*` se hornean **en tiempo de build**.
Cambiarlas no surte efecto hasta redesplegar, y hay que marcarlas para el
entorno correcto (Production/Preview). Esto ya causó un 404 fantasma.

---

## Límites de la API de Clash of Clans (verificados, importantes)

Estos límites condicionan el diseño. No son suposiciones.

1. **Solo existe la CWL en curso.** `clans/{tag}/currentwar/leaguegroup`
   devuelve el grupo actual; no hay endpoint de temporadas pasadas. El
   histórico solo existe porque la app guarda un snapshot en Redis cada
   temporada. Si un mes no se sincroniza, se pierde para siempre.
2. **El war log no trae datos por jugador.** `clans/{tag}/warlog` solo da
   resúmenes (resultado, estrellas totales, destrucción). Para stats por
   jugador de guerras normales hay que **sondear la guerra mientras está
   viva** (`clans/{tag}/currentwar`). Es lo que hacen bots como ClashPerk.
   Además requiere que el war log del clan sea **público**.
3. **`warPreference` solo está en el perfil individual** (`players/{tag}`),
   no en el listado de miembros. Saber quién está opted-out cuesta ~50
   peticiones. Y la API **no da ninguna fecha** de cuándo cambió.
4. **Rate limit por segundo, sin cuota mensual.** Referencia habitual de
   las librerías: ~10 req/s por token. Pasarse devuelve 429, sin
   penalización acumulada. Las tandas van de 6 en 6 por esto.
5. **Los tags** usan solo el alfabeto `0289PYLQGRJCUV`. Nunca llevan la
   letra O (es cero). `normalizeTag()` en `cocApi.js` limpia puntuación,
   pasa a mayúsculas y convierte O→0. **Siempre normalizar antes de
   comparar** con tags devueltos por la API: ya hubo un bug por esto.
6. **Fechas** en formato `20260829T120000.000Z`, que `Date` no parsea. Hay
   un helper que inserta los separadores ISO.

---

## Reglas de negocio (aclaradas por Santi)

- **Solo las guerras TERMINADAS (`warEnded`) cuentan para las
  estadísticas.** Una ronda en curso no suma nada hasta que cierra.
  "Sincronización guerra a guerra" = cada ronda se incorpora al acabar, no
  en tiempo real. Esto se implementó al revés una vez y hubo que revertir.
- Las guerras en curso **sí** se muestran en la vista en vivo
  (`CurrentWarView`) y en el home, pero como información, sin tocar datos.
- **"Activo" = está en cualquiera de los dos clanes**, no solo en el que se
  está filtrando. Los jugadores se mueven entre principal y secundario.
- El filtro "Current members only" está **activado por defecto**, pero se
  desactiva solo si el roster no ha cargado (si no, la tabla saldría vacía
  y parecería pérdida de datos).
- **La lista de opted-out es una regla interna** y aplica solo a guerras
  normales: si estás OUT no se espera tu ataque. Se captura **al empezar
  cada guerra** (clave: `preparationStartTime`) y se congela.
- **Defensa no castigada:** si a un jugador no le atacó nadie en una
  guerra terminada, NO se le premia: se le imputa una defensa de
  **2 estrellas y 85% de destrucción** (`UNPUNISHED_DEFENSE_STARS` /
  `UNPUNISHED_DEFENSE_DEST` en `cwlSync.js`). Mismo criterio que usaba la
  hoja de cálculo manual; mantenerlo para que el histórico sea comparable.
- `avgDistance` = **posición propia − posición del objetivo**. Confirmado
  contra la definición del bot original: jugador en la posición 5 atacando
  en 20/25/30 da media −20.
- `threeRate` = triples / guerras alineadas. **No** es estrellas obtenidas
  sobre posibles. Se planteó cambiarlo y se descartó para no romper la
  comparabilidad con las 11 temporadas históricas del bot.

### Bonos de CWL — PENDIENTE DE CALIBRAR

`bonusCalculator.js` calcula: bonos base según liga + 1 por guerra ganada.
Eso es correcto. Pero hay **dos aproximaciones sin verificar**:

- La tabla base para **5v5** (estimada dividiendo la de 15v15 entre 3).
- La **caída de valor de medalla por posición final** (lineal, ~8% por
  puesto).

15v15 y 30v30 reparten el mismo número de bonos. Si Santi aporta un caso
real (liga + tamaño + guerras ganadas + número que da el juego), calibrar
con ese dato en lugar de con las estimaciones.

---

## Sistema de diseño

Dirección elegida: **"hairline technical"** — bordes finos, sin rellenos,
mono para cifras, denso pero no gaming. Referencias: Linear, Vercel,
Supabase. Explícitamente **no**: neón, degradados llamativos, tipografías
sci-fi (se probó Orbitron y se descartó).

### Tokens (en `public/index.html`, config de Tailwind por CDN)

- `surface-950/900/850/800/700` — escala de superficies. La profundidad
  viene de escalones de gris, **no** de bordes por todas partes.
- `line` / `line-strong` — bordes hairline.
- `txt-hi/mid/low/dim` — cuatro niveles de texto.
- `accent-*` — color principal, **ajustable por el usuario** en Ajustes.
- `alert-*` (alias `rust-*`) — color de aviso, **también ajustable**.
- `ok-*` / `bad-*` — semánticos, fijos.
- `amber` / `azure` / `lime` — realces puntuales.
- `void/ink/signal/steel` — **alias legacy** remapeados a los nuevos
  valores. Existen para no romper componentes sin migrar. No usar en
  código nuevo.

Por defecto: acento **lime**, alerta **rust** (naranja). Opciones
disponibles: lime, azure, amber, rust, violet.

**Acento ajustable:** `accent` y `alert` se definen como
`rgb(var(--accent-400) / <alpha-value>)`. `window.setPaletteRole(role,
name)` cambia las variables CSS al vuelo. Las paletas están en
`window.ACCENTS`. Se guarda en localStorage. Por eso los gráficos de
recharts usan `cssVar()` para leerlas en tiempo de render.

**Tipografía:** solo **Inter** (interfaz) + **JetBrains Mono** (cifras). Se
simplificó desde tres familias. Las cifras de tabla llevan
`font-variant-numeric: tabular-nums`.

**IMPORTANTE:** `src/styles.css` **debe importarse en `src/index.js`**.
Durante meses no lo estaba y ninguna regla se aplicaba.

### Convenciones visuales

- Un solo acento; el color solo cuando significa algo.
- Los clanes **no** se distinguen por color, sino por nombre y pestaña.
- `rounded-md`, `font-semibold`, sin sombras, sin degradados.

---

## Estado actual

### Funciona
- Sync de CWL desde la API (`cwlSync.js`), liga/posición/guerras
  ganadas/tamaño automáticos.
- Home como panel de estado (`SeasonSelector.jsx`, mal nombrado ya):
  CWL en curso, guerra normal, ataques pendientes plegables, altas/bajas,
  opted-out por guerra.
- `CurrentWarView` — vista en vivo de la ronda de CWL.
- Métricas de guerra en el home (`homeStatus.js`): ataques usados/totales,
  **ataques que le quedan al rival**, aldeas nuestras sin atacar, aldeas
  que aguantaron a 0★, y estrellas que quedan en juego.
- `HistoricalView` — histórico entre temporadas, agrupa por **tag** (con
  respaldo por nombre para temporadas antiguas sin tag).
- Config de clanes en Redis (`api/clan-config.js`) + caché en localStorage.
- Columnas visibles persistidas en localStorage.

### Mapa de vistas (App.js enruta por `view`)

- `view === "selector"` → **`SeasonSelector.jsx`** = el HOME (panel de
  estado). Mal nombrado: ya no es un selector. Las temporadas son un
  desplegable al pie.
- `view === "import"` → **`ImportView.jsx`** = sincronizar / importar.
  Contiene `LeagueSettings` y **`SeasonList`** (la lista de temporadas con
  botones Open/Delete), más el textarea de pegado manual plegado.
- resto → **`Dashboard.jsx`** = tabla de la temporada activa
  (`StatsTable`, `StatsCards`, `ClanTabs`, `ColumnSelector`).
- Modales/overlays: `HistoricalView`, `CurrentWarView`, `SettingsModal`,
  `NewSeasonModal`, `DeleteConfirmModal`, `PlayerModal` (lazy).

**No hay componentes huérfanos**: los 17 están en uso. `SeasonList` lo usa
`ImportView`, **no** `SeasonSelector` — no confundir las dos pantallas.
`PlayerModal` entra por `lazy(() => import(...))`, así que un grep de
`from "./PlayerModal"` da falso negativo.

### Modelo de datos de una temporada

`{ id, name, year, mainClan: [...], secondaryClan: [...], leagueInfo }`.
`leagueInfo` tiene por clan: `{ league, position, warsWon, warSize }`.
`warSize` (5/15/30) se añadió para el cálculo de bonos y lo rellena el sync
desde `teamSize`. Cada jugador: `name, tag, clan, th, wars, missAtk,
missDef, offStars, offDest, defStars, defDest, netStars, netDest,
threeRate, stars3/2/1/0, avgDistance`.

Las temporadas antiguas (pegadas a mano) **no tienen `tag`**: el histórico
cae a agrupar por nombre en esos casos. `dataParser.js` sigue existiendo
como respaldo manual (textarea plegado en `ImportView`) por si la API falla
o el clan no está en CWL.

### Eliminado a propósito
- Compartir por enlace (obsoleto: todo se guarda). Se borraron
  `shareUtils.js`, `api/share.js`, `api/get-share.js`.
- Merge manual de jugadores y lista manual de miembros activos
  (`useHistoricalSettings.js`). **Nota:** al eliminarlo se perdieron las
  reglas de merge que Santi tuviera configuradas.
- `oldfullApp js`, `src/utils/redis.js` duplicado.

### Pendiente
1. **Guerras normales con stats por jugador** (lo siguiente a abordar).
   Requiere el cron: sin sondeo periódico se pierden la mayoría, porque el
   ciclo es de ~48h.
2. **Cron** — ver sección dedicada más abajo.
3. Creación automática de temporada desde `group.season` (`"2026-08"`).
4. Mover a Redis lo que aún está en localStorage: histórico de opted-out,
   snapshot de roster para altas/bajas.
5. `StatsTable` aún no usa `font-mono` en las cifras.
6. Posibles secciones nuevas: Clan Capital
   (`clans/{tag}/capitalraidseasons`, sí guarda histórico), donaciones
   (gratis, ya viene en el listado de miembros), preparación de guerra
   (héroes vía `players/{tag}`).

---

## Plan del cron (acordado, sin implementar)

Es la pieza que desbloquea las guerras normales y evita perder temporadas.

**Por qué un programador externo y no el de Vercel:** en plan Hobby los
cron de Vercel solo admiten **1 ejecución al día** (cualquier expresión más
frecuente falla en el despliegue) y el disparo no es puntual (margen de una
hora). Las funciones tienen **10 s de timeout** (Pro: 60 s, ampliable a
300 s, por 20 $/mes). Para guerras normales 1×día es insuficiente: el ciclo
es de ~48 h y se perderían guerras.

**Solución acordada:** `/api/sync` es una ruta HTTP normal que acepta
llamadas de cualquiera, así que un programador externo gratuito
(**cron-job.org** o **GitHub Actions**) la llama **cada hora**. GitHub
Actions evita depender de otro servicio pero sus workflows programados se
retrasan cuando GitHub va cargado.

**Qué construir:**
1. `api/sync.js` — valida `Authorization: Bearer ${CRON_SECRET}`, lee los
   tags de Redis, llama al proxy, agrega y escribe. Mover aquí la lógica
   de `cwlSync.js` **elimina la duplicación** (hoy el navegador hace las
   ~60 llamadas) y **saca el secreto del proxy del bundle del cliente**,
   que es el problema de seguridad real pendiente.
2. **Sync incremental**: guardar en Redis los `warTag` ya procesados y no
   volver a pedirlos. Las guerras terminadas no cambian nunca. Es
   imprescindible para caber en 10 s, sobre todo con Render dormido.
3. `ImportView` pasa a llamar al endpoint en vez de hacer el trabajo.
4. Variables de servidor nuevas (sin prefijo `REACT_APP_`):
   `COC_PROXY_URL`, `COC_PROXY_SECRET`, `CRON_SECRET`.

**Efecto colateral bueno:** un cron horario mantiene despierto el servicio
de Render.

**Orden:** se decidió hacer primero el rediseño visual y después el cron,
para no reescribir `ImportView` dos veces.

---

## Cómo trabajar en este proyecto

- **Santi prefiere que se le proponga antes de implementar.** Presentar
  opciones y esperar su OK; no escribir código en cuanto se menciona una
  idea.
- Verificar con `CI=true npm run build` antes de dar nada por bueno.
  ESLint trata los warnings como errores en CI.
- `.eslintrc.json` debe extender `react-app`. Apuntaba a un parser de
  TypeScript inexistente y **bloqueaba todos los builds**.
- Al eliminar funcionalidad, buscar código huérfano: ya quedaron varias
  funciones sin usar que rompieron el build. Pero **comprobar con grep
  antes de declarar algo huérfano**: en este archivo llegó a afirmarse que
  `SeasonList.jsx` lo estaba (deducido, no verificado) y borrarlo habría
  roto el build. Cuidado también con los `lazy(() => import(...))`, que no
  aparecen en una búsqueda de `from "./X"`.
- No inventar datos ni fórmulas: si un cálculo depende de reglas del juego
  que no están verificadas, decirlo explícitamente y marcarlo en el código.
- Los datos de las 11 temporadas históricas **no son recuperables** desde
  la API. Antes de tocar la persistencia, recomendar copia de seguridad
  desde `/api/get-seasons`.
