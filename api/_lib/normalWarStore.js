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

module.exports = { finalizedKey, readJson, finalizeIfNew, replaceManual };
