# CLAUDE.md — Contexto del proyecto CWL Stats Tracker

Este archivo lo lee Claude Code automáticamente. Recoge decisiones,
convenciones y límites descubiertos que no son evidentes leyendo el código.

---

## Qué es

App para llevar estadísticas de Clan War League (CWL) de Clash of Clans de
dos clanes: **True North** (principal) y **DD** (secundario). Sustituye un
flujo manual anterior en el que se pegaban datos de un bot desde una hoja
de cálculo.

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

**Clave de escritura (opt-in):** si se define `WRITE_SECRET` en Vercel **y**
`REACT_APP_WRITE_SECRET` con el mismo valor, los endpoints que escriben
(`save-season`, `delete-season`, `clan-config`, `seasons-backups`) la exigen
(cabecera `x-write-secret`). Si solo se define una de las dos, la app deja
de poder guardar. Igual que el secreto del proxy, la del cliente va en el
bundle: frena curls a ciegas, no es seguridad real. Sin `WRITE_SECRET` no se
exige nada (estado actual por defecto).

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
- **Orden por defecto de los resultados de CWL** (`src/utils/sortPlayers.js`,
  copia en `api/_lib/cwlAggregate.js`): 1º menos ataques fallados (nadie con
  un fallo puede estar por encima de quien no ha fallado); 2º más net stars,
  y los empates dentro de net stars se rompen por guerras jugadas, luego
  ataques contra un TH **igual o superior** al propio (`sameTh + higherTh`,
  los "dips" a TH menores no cuentan), luego 3★%; al final net destruction.
  **El nombre nunca desempata** (decisión de Santi). `avgDistance` ya no
  ordena (solo se muestra).
- `sameTh` / `higherTh` = ataques contra el mismo TH / uno superior. La API
  los calcula (con sus `...Triples`); del pegado del bot salen de `Number of
  Attacks − Lower TH Hits − Upper TH Hits` y `Upper TH Hits`. Las temporadas
  guardadas antes no los tienen: se muestra "—" y cuentan como 0 al ordenar
  hasta que se resincronicen/repeguen. Ojo: el bot y la API pueden clasificar
  algún ataque distinto (p. ej. Wiki_Ziki: bot 4 reaches + 1 dip, API 5 superiores).
- **Dos sistemas de orden coexisten** (`sortForDisplay` en `sortPlayers.js`):
  el nuevo se usa cuando los jugadores del clan traen `sameTh` (datos de la
  API, o pegado del bot con las columnas Dips/Reaches); si no, se usa el
  anterior tal cual (missed, net stars, solo en el secundario menor distancia
  media, 3★%, net destruction), con sus columnas de siempre. Así las
  temporadas anteriores no cambian. Cada sistema recuerda sus columnas en su
  propia clave: `cwl-visible-cols` (anterior) y `cwl-visible-cols-v2` (nuevo).
- `avgDistance` (posición propia − posición del objetivo): **+ es bueno**
  (atacó bases más fuertes), **− es malo** (atacó bases más débiles). OJO: el
  orden ANTERIOR del clan secundario desempata por la distancia más baja
  primero, es decir, premia la negativa; se dejó tal cual para no cambiar las
  temporadas antiguas, pero va al revés que este criterio.
- Las columnas visibles se guardan en `cwl-visible-cols-v2` (se versiona para
  poder reiniciar las preferencias cuando cambian las columnas del orden).
- `avgDistance` = **posición propia − posición del objetivo**. Confirmado
  contra la definición del bot original: jugador en la posición 5 atacando
  en 20/25/30 da media −20.
- `threeRate` = triples / guerras alineadas. **No** es estrellas obtenidas
  sobre posibles. Se planteó cambiarlo y se descartó para no romper la
  comparabilidad con las 11 temporadas históricas del bot.

### Persistencia de temporadas (importante, hubo una pérdida de datos)

`cwl-seasons` es UN array en Redis. Reglas actuales (`api/_lib/seasonStore.js`):

- **`save-season` fusiona por id, nunca borra por omisión.** Un cliente con la
  lista sin cargar ya no puede vaciar nada. Cada clan de una temporada lleva
  su sello (`mainAt` / `secondaryAt`) y gana el más reciente: el cliente lo
  pone al editar (`stampSeason` en `useSeasons.js`), el sync automático al
  escribir.
- **Borrar** va por `DELETE /api/delete-season?id=` (o `?all=1`), con
  tombstones (`cwl-seasons-deleted`) para que un cliente viejo no resucite
  lo borrado ni el sync recree el mes borrado.
- **Copias de seguridad** rotativas (5) antes de cada escritura que cambia
  algo y siempre antes de borrar: `GET /api/seasons-backups` (lista) y
  `?n=1` (contenido). Restaurar = `POST /api/save-season` con
  `{ seasons, replace: true }`.
- Escrituras serializadas con un lock en Redis (`cwl-seasons-lock`).
- Cada temporada lleva `cwlSeason: "2026-10"` (de `group.season`), que es lo
  que la vincula con su CWL. Las anteriores a esto no lo tienen: se adoptan
  por mes de creación o nombre, y los clanes que ya tenían jugadores se
  marcan `manual`.
- `manual: {main, secondary}`: lo pegado a mano. El sync **automático** no lo
  pisa; "Sync now" sí (y quita la marca). `cwlComplete: {main, secondary}`:
  la liga ya terminó y se guardó la versión final; no se vuelve a tocar.
- "Sync now" en el cliente **se niega a guardar** si la CWL descargada es de
  un mes distinto a la temporada abierta (así acabaron los datos de octubre
  dentro de "September").
- Límite a vigilar: Upstash free admite ~1 MB por petición y las temporadas
  ocupan ~250 KB (+25 KB/mes).

### Sync automático de CWL

`api/sync.js` (el mismo cron de guerras normales) llama a
`api/_lib/cwlSyncServer.js` por clan: crea la temporada del mes cuando
aparece el grupo y añade cada ronda al terminar. Es incremental (guarda las
guerras terminadas en `cwl-state:{tag}`). La API de Clash solo expone la CWL
en curso y el grupo desaparece cuando el clan empieza otra guerra, así que lo
no capturado a tiempo se pierde: el cron debe correr durante toda la liga.
`api/_lib/cwlAggregate.js` es copia de la lógica de `src/utils/cwlSync.js`
(el cliente no puede importar de `api/`): cambios de criterio, en ambos.

### Bonos de CWL — PENDIENTE DE CALIBRAR

`bonusCalculator.js` calcula: bonos base según liga + 1 por guerra ganada.
Eso es correcto. Queda **una aproximación sin verificar**:

- La tabla base para **5v5** (estimada dividiendo la de 15v15 entre 3).
  **CWL solo se juega en 15v15 o 30v30 actualmente** — el 5v5 existió una
  única temporada y Supercell lo retiró después (confirmado por Santi). La
  opción se mantiene en el selector solo por si hace falta editar esa
  temporada histórica concreta; no debería aparecer como elección real
  para temporadas nuevas.
- (Se eliminó `calculateMedalValue` y su tabla de medallas: ninguna pantalla
  las usaba y eran valores sin verificar.)

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
- `HistoricalView` — histórico entre temporadas, agrupa por **tag** (con
  respaldo por nombre para temporadas antiguas sin tag).
- Config de clanes en Redis (`api/clan-config.js`) + caché en localStorage.
- Columnas visibles persistidas en localStorage.

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
2. ~~Cron~~ (hecho para guerras normales y CWL; el texto siguiente es el plan original). Plan acordado: endpoint `/api/sync` que hace el trabajo en
   servidor (elimina la duplicación de lógica y saca el secreto del
   navegador), sync **incremental** (guardar warTags ya procesados; las
   guerras terminadas no cambian), y un programador **externo**
   (cron-job.org o GitHub Actions) llamándolo cada hora.
   Motivo: Vercel Hobby limita cron a **1×día** y las funciones a **10s**;
   Pro son 20 $/mes. El endpoint HTTP acepta llamadas de cualquiera, así
   que un programador externo evita el límite. Validar `CRON_SECRET`.
   Los tags ya están en Redis, que era requisito previo.
3. ~~Creación automática de temporada~~ (hecho en `cwlSyncServer.js`).
4. Mover a Redis lo que aún está en localStorage: histórico de opted-out,
   snapshot de roster para altas/bajas.
5. `StatsTable` aún no usa `font-mono` en las cifras.
6. Posibles secciones nuevas: Clan Capital
   (`clans/{tag}/capitalraidseasons`, sí guarda histórico), donaciones
   (gratis, ya viene en el listado de miembros), preparación de guerra
   (héroes vía `players/{tag}`).

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
  funciones sin usar que rompieron el build.
- No inventar datos ni fórmulas: si un cálculo depende de reglas del juego
  que no están verificadas, decirlo explícitamente y marcarlo en el código.
- Los datos de las 11 temporadas históricas **no son recuperables** desde
  la API. Antes de tocar la persistencia, recomendar copia de seguridad
  desde `/api/get-seasons`.
