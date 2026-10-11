// Lectura/escritura de las temporadas de CWL en Redis, compartida por los
// endpoints del cliente (save-season, delete-season) y por el sync
// automatico (cwlSyncServer.js).
//
// Por que existe esto: antes cada guardado del cliente SUSTITUIA el array
// completo, asi que (1) un cliente con la lista aun sin cargar borraba las
// 12 temporadas de golpe, y (2) ahora que el servidor tambien escribe
// temporadas, cualquier guardado de un cliente con datos viejos habria
// pisado lo que el sync acababa de guardar. Aqui:
//  - los guardados se FUSIONAN por id (nunca borran por omision),
//  - los borrados van por un endpoint propio, con tombstones,
//  - toda escritura que cambia algo guarda antes una copia de seguridad,
//  - las escrituras se serializan con un lock en Redis.
const redis = require("../redis");

const SEASONS_KEY = "cwl-seasons";
const DELETED_KEY = "cwl-seasons-deleted";
const BACKUP_PREFIX = "cwl-seasons-bak-";
const BACKUP_AT_KEY = "cwl-seasons-bak-at";
const LOCK_KEY = "cwl-seasons-lock";
const BACKUP_SLOTS = 5;
// Las copias no se guardan mas de una cada 30 min salvo operaciones
// destructivas (force), para no llenar los huecos con estados casi iguales.
const BACKUP_MIN_GAP_MS = 30 * 60 * 1000;

const parse = (data, fallback) => {
  if (data === null || data === undefined) return fallback;
  return typeof data === "string" ? JSON.parse(data) : data;
};

const readSeasons = async () => {
  const list = parse(await redis.get(SEASONS_KEY), []);
  return Array.isArray(list) ? list : [];
};

const readDeleted = async () => {
  const list = parse(await redis.get(DELETED_KEY), []);
  return Array.isArray(list) ? list : [];
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ejecuta fn con el lock de temporadas. El lock caduca solo a los 20 s, asi
 * que una funcion que muera a medias no lo deja atascado. Si no se consigue
 * en ~4 s se lanza error: es preferible que un guardado falle (el cliente
 * lo muestra y se puede repetir) a que dos escrituras se pisen.
 */
const withLock = async (fn) => {
  const token = `${Date.now()}-${Math.random()}`;
  let acquired = false;
  for (let i = 0; i < 8 && !acquired; i++) {
    const res = await redis.set(LOCK_KEY, token, { nx: true, ex: 20 });
    if (res) acquired = true;
    else await sleep(500);
  }
  if (!acquired) {
    const err = new Error("Seasons are being written by another process, try again");
    err.code = "LOCKED";
    throw err;
  }
  try {
    return await fn();
  } finally {
    try {
      // Solo se libera si el lock sigue siendo nuestro (podria haber
      // caducado y haberlo tomado otro).
      const current = await redis.get(LOCK_KEY);
      if (current === token) await redis.del(LOCK_KEY);
    } catch (e) {
      // caduca solo
    }
  }
};

/**
 * Copia de seguridad rotativa (5 huecos) del estado ACTUAL de Redis. Se
 * llama antes de escribir. force=true en borrados y restauraciones.
 */
const snapshotSeasons = async (reason, force = false) => {
  const current = await readSeasons();
  if (current.length === 0) return;
  const lastAt = Number(await redis.get(BACKUP_AT_KEY)) || 0;
  if (!force && Date.now() - lastAt < BACKUP_MIN_GAP_MS) return;

  for (let i = BACKUP_SLOTS; i > 1; i--) {
    const prev = await redis.get(`${BACKUP_PREFIX}${i - 1}`);
    if (prev) {
      await redis.set(`${BACKUP_PREFIX}${i}`, typeof prev === "string" ? prev : JSON.stringify(prev));
    }
  }
  await redis.set(
    `${BACKUP_PREFIX}1`,
    JSON.stringify({ at: Date.now(), reason, seasons: current })
  );
  await redis.set(BACKUP_AT_KEY, String(Date.now()));
};

const listBackups = async () => {
  const out = [];
  for (let i = 1; i <= BACKUP_SLOTS; i++) {
    const b = parse(await redis.get(`${BACKUP_PREFIX}${i}`), null);
    if (b) out.push({ n: i, at: b.at, reason: b.reason, count: (b.seasons || []).length });
  }
  return out;
};

const readBackup = async (n) => parse(await redis.get(`${BACKUP_PREFIX}${n}`), null);

// Campos que pertenecen a "un clan dentro de una temporada" y viajan juntos
// en la fusion: gana la version con el sello (`...At`) mas reciente. Los
// pone tanto el cliente (al editar) como el sync automatico (al escribir).
const CLANS = [
  { key: "main", players: "mainClan", at: "mainAt" },
  { key: "secondary", players: "secondaryClan", at: "secondaryAt" },
];

/**
 * Fusiona la version del servidor y la que manda un cliente de UNA temporada.
 * - Campos generales (nombre, bonos, orden...): gana el `updatedAt` mayor;
 *   en empate gana el cliente.
 * - Cada clan (jugadores + liga + flags) gana por su propio sello: asi un
 *   cliente con datos viejos no pisa lo que el sync automatico acaba de
 *   guardar, ni al reves una pegada manual reciente la pisa el sync.
 */
const mergeSeason = (server, incoming) => {
  const base = (incoming.updatedAt || 0) >= (server.updatedAt || 0) ? incoming : server;
  const out = { ...base };
  const leagueInfo = { ...(base.leagueInfo || {}) };
  const manual = {};
  const cwlComplete = {};

  CLANS.forEach(({ key, players, at }) => {
    const src = (server[at] || 0) > (incoming[at] || 0) ? server : incoming;
    out[players] = src[players] || [];
    if (src[at] !== undefined) out[at] = src[at];
    else delete out[at];
    if (src.leagueInfo && src.leagueInfo[key]) leagueInfo[key] = src.leagueInfo[key];
    if (src.manual && src.manual[key] !== undefined) manual[key] = src.manual[key];
    if (src.cwlComplete && src.cwlComplete[key] !== undefined) cwlComplete[key] = src.cwlComplete[key];
  });

  out.leagueInfo = leagueInfo;
  if (Object.keys(manual).length) out.manual = manual;
  else delete out.manual;
  if (Object.keys(cwlComplete).length) out.cwlComplete = cwlComplete;
  else delete out.cwlComplete;
  out.cwlSeason = incoming.cwlSeason || server.cwlSeason;
  if (!out.cwlSeason) delete out.cwlSeason;
  out.updatedAt = Math.max(incoming.updatedAt || 0, server.updatedAt || 0) || undefined;
  if (out.updatedAt === undefined) delete out.updatedAt;
  return out;
};

/**
 * Fusion de listas. Nada se borra por omision: una temporada que el servidor
 * tiene y el cliente no (p. ej. la que acaba de crear el sync) se conserva y
 * va PRIMERO (es la mas nueva); el resto sigue el orden del cliente. Los ids
 * de `deleted` (tombstones) no se resucitan aunque un cliente viejo los
 * siga teniendo.
 */
const mergeSeasons = (serverList, incomingList, deleted = []) => {
  const gone = new Set(deleted);
  const serverById = new Map(serverList.map((s) => [s.id, s]));
  const incomingIds = new Set(incomingList.map((s) => s.id));

  const serverOnly = serverList
    .filter((s) => !incomingIds.has(s.id))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const fromIncoming = incomingList
    .filter((s) => !gone.has(s.id) || serverById.has(s.id))
    .map((s) => (serverById.has(s.id) ? mergeSeason(serverById.get(s.id), s) : s));

  return [...serverOnly, ...fromIncoming];
};

/** Escribe sin lock ni copia: usar solo dentro de withLock tras snapshotSeasons. */
const writeSeasonsRaw = (seasons) => redis.set(SEASONS_KEY, JSON.stringify(seasons));

const addDeleted = async (ids) => {
  const current = await readDeleted();
  const merged = Array.from(new Set([...current, ...ids])).slice(-200);
  await redis.set(DELETED_KEY, JSON.stringify(merged));
};

const removeDeleted = async (ids) => {
  const drop = new Set(ids);
  const current = await readDeleted();
  await redis.set(DELETED_KEY, JSON.stringify(current.filter((id) => !drop.has(id))));
};

module.exports = {
  SEASONS_KEY,
  readSeasons,
  readDeleted,
  withLock,
  snapshotSeasons,
  listBackups,
  readBackup,
  mergeSeason,
  mergeSeasons,
  writeSeasonsRaw,
  addDeleted,
  removeDeleted,
};
