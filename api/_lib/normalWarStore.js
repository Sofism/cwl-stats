// Lectura/escritura compartida del historico de guerras normales en Redis.
// La usan tanto api/sync.js (cron automatico) como api/save-normal-war.js
// (pegado manual), para no duplicar la logica de deduplicar por warKey.
const redis = require("../redis");

const finalizedKey = (tag) => `normal-wars:${tag}`;

const readJson = async (key, fallback) => {
  const data = await redis.get(key);
  if (!data) return fallback;
  return typeof data === "string" ? JSON.parse(data) : data;
};

/** Guarda `record` en el historico del clan si su warKey no estaba ya. */
const finalizeIfNew = async (tag, record) => {
  if (!record) return false;
  const finalized = await readJson(finalizedKey(tag), []);
  if (finalized.some((w) => w.warKey === record.warKey)) return false;
  finalized.push(record);
  await redis.set(finalizedKey(tag), JSON.stringify(finalized));
  return true;
};

/**
 * El pegado manual es un AGREGADO de varias guerras a la vez (ultimas N),
 * no una guerra suelta identificable por warKey. Pegar de nuevo mas tarde
 * casi seguro solapa con guerras ya contadas en el pegado anterior, asi
 * que en vez de acumular registros manuales (que sumaria dos veces las
 * guerras solapadas) se guarda como una UNICA foto que sustituye a la
 * anterior por completo. Los registros del cron (source: "cron") no se
 * tocan.
 */
const replaceManual = async (tag, record) => {
  const finalized = await readJson(finalizedKey(tag), []);
  const withoutManual = finalized.filter((w) => w.source !== "manual");
  withoutManual.push(record);
  await redis.set(finalizedKey(tag), JSON.stringify(withoutManual));
};

// Los jugadores salen del clan por minutos u horas y vuelven; la API solo
// dice quien esta AHORA y no da la fecha de salida. Para no hacerlos
// parpadear en las stats se anota cuando se vio por ultima vez a cada uno
// en el clan, y solo se ocultan pasada la gracia.
const LAST_SEEN_GRACE_MS = 12 * 60 * 60 * 1000;
const LAST_SEEN_PRUNE_MS = 30 * 24 * 60 * 60 * 1000;
const lastSeenKey = (tag) => `clan-last-seen:${tag}`;

/**
 * Anota `ahora` como ultima vez vista de cada miembro actual y devuelve el
 * mapa completo { playerTag: timestamp }. Sin miembros (fallo de red: la API
 * nunca devuelve un clan vacio) no toca nada.
 */
const touchRoster = async (tag, members) => {
  const seen = await readJson(lastSeenKey(tag), {});
  if (!members || members.length === 0) return seen;
  const now = Date.now();
  members.forEach((m) => {
    seen[m.tag] = now;
  });
  Object.keys(seen).forEach((k) => {
    if (now - seen[k] > LAST_SEEN_PRUNE_MS) delete seen[k];
  });
  await redis.set(lastSeenKey(tag), JSON.stringify(seen));
  return seen;
};

/** Tags vistos dentro de la gracia, o null si aun no hay ningun dato. */
const activeTagsFromSeen = (seen) => {
  const keys = Object.keys(seen || {});
  if (keys.length === 0) return null;
  const now = Date.now();
  return keys.filter((k) => now - seen[k] <= LAST_SEEN_GRACE_MS);
};

module.exports = {
  finalizedKey,
  readJson,
  finalizeIfNew,
  replaceManual,
  touchRoster,
  activeTagsFromSeen,
};
