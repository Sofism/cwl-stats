/**
 * Orden por defecto de los resultados de CWL (acordado con Santi):
 *  1. Menos ataques fallados (missed). Quien ha fallado un ataque no puede
 *     estar por encima de quien no ha fallado ninguno.
 *  2. Mas estrellas netas. Los empates, dentro de net stars, se rompen por:
 *       a. mas guerras jugadas (wars in),
 *       b. mas ataques contra un TH IGUAL O SUPERIOR al propio
 *          (sameOrHigherTh): atacar hacia arriba puntua tan bien como hacia
 *          el mismo nivel, atacar a TH menores (dips) no cuenta,
 *       c. mayor hit rate (3★%).
 *  3. Cierre: mayor destruccion neta. El nombre NUNCA desempata (decision
 *     de Santi): un empate total se queda empatado, en el orden en que
 *     vengan los datos (el sort de JS es estable).
 *
 * Un dato que falte (temporadas guardadas antes de existir sameTh/higherTh)
 * cuenta como 0: sigue ordenando, solo que sin ese desempate.
 */
export const sameOrHigherTh = (p) => (p.sameTh || 0) + (p.higherTh || 0);

export const comparePlayers = (a, b) =>
  (a.missAtk || 0) - (b.missAtk || 0) ||
  (b.netStars || 0) - (a.netStars || 0) ||
  (b.wars || 0) - (a.wars || 0) ||
  sameOrHigherTh(b) - sameOrHigherTh(a) ||
  (b.threeRate || 0) - (a.threeRate || 0) ||
  (b.netDest || 0) - (a.netDest || 0);

export const sortPlayers = (players) => players.slice().sort(comparePlayers);

/**
 * Hay DOS sistemas de orden, y cual se usa depende de los datos de cada clan
 * en cada temporada (Santi: las temporadas anteriores se siguen viendo tal
 * cual; el sistema nuevo vale para lo que se alimenta de la API):
 *  - nuevo: los jugadores traen `sameTh` (lo escribe el sync de la API y el
 *    pegado del bot cuando incluye las columnas Dips/Reaches).
 *  - anterior: sin ese dato.
 */
export const hasNewRanking = (players) =>
  (players || []).some((p) => p.sameTh !== undefined);

/**
 * Orden anterior, tal cual estaba: missed, net stars, (solo clan secundario)
 * menor distancia media, 3★% y net destruction.
 */
export const compareLegacy = (clanKey) => (a, b) => {
  if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
  if (b.netStars !== a.netStars) return b.netStars - a.netStars;
  if (clanKey !== "main" && a.avgDistance !== b.avgDistance) return a.avgDistance - b.avgDistance;
  if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
  return b.netDest - a.netDest;
};

/** clanKey: "main" | "secondary". Elige el sistema segun los datos. */
export const sortForDisplay = (players, clanKey) =>
  hasNewRanking(players) ? sortPlayers(players) : players.slice().sort(compareLegacy(clanKey));
