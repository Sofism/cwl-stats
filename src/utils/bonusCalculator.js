import { BASE_BONUSES, BASE_BONUSES_30V30, MEDAL_VALUES } from "./constants";

/**
 * El nombre de liga se guarda en DOS formatos distintos segun de donde
 * vino: el sync automatico escribe el nombre tal cual lo da la API de
 * Clash ("Master League I"), mientras que el desplegable manual de
 * LeagueSettings escribe la forma corta ("Master I") que usan las tablas
 * de esta app. Ambos formatos conviven en datos ya guardados (temporadas
 * distintas sincronizadas en momentos distintos), asi que se normaliza
 * aqui en vez de migrar el dato: quitar " League" deja las dos formas
 * iguales. Sin esto, cualquier liga auto-sincronizada y nunca corregida a
 * mano buscaba en la tabla con la clave equivocada y caia siempre a 0.
 */
const normalizeLeagueName = (league) =>
  (league || "").replace(/\s*League\s*/i, " ").replace(/\s+/g, " ").trim();

/**
 * Tabla base de bonuses para guerras 5v5. Supercell introdujo este formato
 * de CWL una única temporada y después lo retiró (confirmado por Santi) —
 * ya no es seleccionable para temporadas nuevas, pero se mantiene aquí por
 * si hace falta editar o recalcular esa temporada histórica concreta.
 *
 * Sigue siendo una aproximación sin verificar (base 15v15 escalada, no hay
 * tabla oficial publicada). Si esa temporada concreta tiene el bono real
 * documentado (liga + guerras ganadas + bono que dio el juego), se puede
 * calibrar con ese dato.
 */
const BASE_BONUSES_5V5 = Object.fromEntries(
  Object.entries(BASE_BONUSES).map(([league, val]) => [
    league,
    Math.max(1, Math.round(val / 3)),
  ])
);

/**
 * Número de bonuses (slots) que el líder puede repartir al final de la CWL.
 *
 * Regla oficial (tabla dada por Santi, 2026-09): bono base según la liga
 * y el tamaño de guerra + 1 bono extra por cada guerra ganada de las 7 de
 * la temporada. 30v30 DOBLA el bono base respecto a 15v15, pero solo
 * existe hasta Master — Champion/Titan/Legend son exclusivamente 15v15,
 * asi que en esas ligas 30v30 no tiene tabla propia y cae al valor de
 * 15v15 (ver BASE_BONUSES_30V30 en constants.js).
 *
 * Si el resultado sigue sin coincidir con lo que da el juego, lo mas
 * probable es que `warsWon` no sea el numero real de guerras ganadas esa
 * temporada — revisar ese dato antes que la formula.
 *
 * @param {Object} params
 * @param {string} params.league - Nombre de la liga (debe existir en BASE_BONUSES)
 * @param {number} params.warsWon - Guerras ganadas esa temporada (0-7)
 * @param {number} params.warSize - Tamaño de guerra: 5, 15 o 30
 */
export const calculateBonusSlots = ({ league, warsWon = 0, warSize = 15 }) => {
  const key = normalizeLeagueName(league);
  let base;
  if (warSize === 5) {
    base = BASE_BONUSES_5V5[key] || 0;
  } else if (warSize === 30) {
    base = BASE_BONUSES_30V30[key] ?? BASE_BONUSES[key] ?? 0;
  } else {
    base = BASE_BONUSES[key] || 0;
  }
  return base + (Number(warsWon) || 0);
};

/**
 * Valor aproximado de cada medalla de bono, ajustado por la posición final
 * (1º-8º) dentro del grupo. La tabla MEDAL_VALUES de constants.js son los
 * valores para el 1er puesto de cada liga; cada posición por debajo reduce
 * el valor de forma progresiva.
 *
 * APROXIMACIÓN: la caída exacta por posición no está documentada de forma
 * fiable y varía entre fuentes. Esto usa una caída lineal del ~8% por
 * puesto (1º = 100%, 8º = ~44%) como punto de partida razonable. Si tienes
 * un caso real con el que contrastar (liga + posición + medallas exactas
 * que dio el juego), lo calibro con ese dato.
 *
 * @param {Object} params
 * @param {string} params.league
 * @param {number} params.position - Posición final (1-8)
 */
export const calculateMedalValue = ({ league, position = 1 }) => {
  const base = MEDAL_VALUES[normalizeLeagueName(league)] || 0;
  const clampedPosition = Math.min(8, Math.max(1, position || 1));
  const decayPerPosition = 0.08;
  const multiplier = Math.max(0.4, 1 - (clampedPosition - 1) * decayPerPosition);
  return Math.round(base * multiplier);
};
