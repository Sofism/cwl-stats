/**
 * Casa el historial OFICIAL de Clash (solo resumenes) con las guerras
 * guardadas por el cron, para listar las guerras de las que NO hay datos por
 * jugador. Se empareja por la hora de fin (+- 3 h).
 */
const parseApiDate = (raw) => {
  if (!raw) return null;
  const d = new Date(
    raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")
  );
  return isNaN(d.getTime()) ? null : d;
};

const SAME_WAR_MS = 3 * 60 * 60 * 1000;

const capturedAttacks = (war) =>
  (war.us?.players || []).reduce((n, pl) => n + (pl.attacks || []).length, 0);

const isEmpty = (war) => capturedAttacks(war) === 0;

/**
 * Una guerra rescatada de una foto (recoveredFromFallback) esta realmente
 * COMPLETA si los ataques capturados igualan los que el historial oficial dice
 * que uso nuestro clan: la foto se tomo cuando ya no faltaba ninguno.
 */
export const isRescuedButComplete = (war, officialItem) =>
  !!war.recoveredFromFallback &&
  !!officialItem &&
  officialItem.us?.attacks != null &&
  capturedAttacks(war) >= officialItem.us.attacks;

/**
 * @param {Array} savedWars guerras guardadas (sin la manual)
 * @param {Array|null} warlog items compactos de /api/get-normal-wars (o null)
 * @returns {{
 *   noData: Array,           entradas oficiales sin datos por jugador
 *   hiddenEmpty: Set,        warKeys de registros guardados vacios que ya
 *                            cubre una entrada oficial (para no duplicar)
 *   officialByWarKey: Map,   item oficial de cada guerra guardada que casa
 *   coverage: object|null    { total, complete, partial, none } desde la
 *                            primera guerra capturada
 * }}
 */
export const matchOfficial = (savedWars, warlog) => {
  const empty = { noData: [], hiddenEmpty: new Set(), officialByWarKey: new Map(), coverage: null };
  if (!Array.isArray(warlog) || warlog.length === 0) return empty;

  const withEnd = savedWars.filter((w) => w.endTime);
  if (withEnd.length === 0) return empty;
  const firstEnd = Math.min(...withEnd.map((w) => parseApiDate(w.endTime)?.getTime() ?? Infinity));

  const noData = [];
  const hiddenEmpty = new Set();
  const officialByWarKey = new Map();
  let complete = 0;
  let partial = 0;

  warlog.forEach((item) => {
    const end = parseApiDate(item.endTime);
    if (!end || end.getTime() < firstEnd - SAME_WAR_MS) return; // antes de empezar a capturar
    const match = withEnd.find(
      (w) => Math.abs((parseApiDate(w.endTime)?.getTime() ?? 0) - end.getTime()) < SAME_WAR_MS
    );
    if (match && !isEmpty(match)) {
      officialByWarKey.set(match.warKey, item);
      if (match.recoveredFromFallback && !isRescuedButComplete(match, item)) partial += 1;
      else complete += 1;
    } else {
      if (match) hiddenEmpty.add(match.warKey);
      noData.push({
        warKey: `official:${item.endTime}`,
        official: true,
        item,
        endTime: item.endTime,
        them: { name: item.them?.name },
      });
    }
  });

  return {
    noData,
    hiddenEmpty,
    officialByWarKey,
    coverage: { total: complete + partial + noData.length, complete, partial, none: noData.length },
  };
};
