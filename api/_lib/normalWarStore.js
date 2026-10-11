// Lectura/escritura del historico de guerras normales en Redis (la usan
// api/sync.js y api/get-normal-wars.js).
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
  touchRoster,
  activeTagsFromSeen,
};
