// Insignias de los clanes (las del juego, con el nivel dentro de la imagen).
// Las refresca el CRON (api/sync.js), no la lectura de la config: pedirlas a
// Clash en medio de la carga de la app la dejaba esperando (con el proxy de
// Render dormido, hasta un minuto). El cron ya habla con Clash y nadie espera.
const redis = require("../redis");
const { getClanInfo } = require("./cocProxy");

const KEY = "cwl-clan-config";
const REFRESH_MS = 24 * 60 * 60 * 1000; // el nivel cambia: se refresca una vez al dia
const RETRY_MS = 10 * 60 * 1000; // si Clash falla, no insistir en cada ejecucion

const parse = (raw) => (raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null);

/**
 * Si toca (primera vez, falta alguna, o pasaron 24 h), pide las insignias a
 * Clash y las guarda en la config. Devuelve true si pidio algo. Mejor
 * esfuerzo: cualquier fallo se anota y se reintenta pasados 10 min.
 */
const refreshBadgesIfDue = async (config, now = Date.now()) => {
  if (!config || (!config.mainTag && !config.secondaryTag)) return false;
  const missing =
    (config.mainTag && !config.mainBadge) || (config.secondaryTag && !config.secondaryBadge);
  const fresh = config.badgesAt && now - config.badgesAt < REFRESH_MS;
  if (fresh && !missing) return false;
  if (config.badgesTriedAt && now - config.badgesTriedAt < RETRY_MS) return false;

  const found = {};
  for (const [tagKey, badgeKey] of [["mainTag", "mainBadge"], ["secondaryTag", "secondaryBadge"]]) {
    if (!config[tagKey]) continue;
    try {
      const info = await getClanInfo(config[tagKey]);
      const url = info && info.badgeUrls && (info.badgeUrls.medium || info.badgeUrls.large);
      if (url) found[badgeKey] = url;
    } catch (err) {
      console.error("Badge refresh error:", err.message);
    }
  }

  // Se vuelve a leer justo antes de escribir y solo se tocan los campos de
  // insignia: asi no se pisa un cambio de nombres/tags hecho mientras tanto.
  const latest = parse(await redis.get(KEY)) || config;
  const next = { ...latest, ...found, badgesTriedAt: now };
  if (Object.keys(found).length > 0) next.badgesAt = now;
  await redis.set(KEY, JSON.stringify(next));
  return true;
};

module.exports = { refreshBadgesIfDue };
