// Insignias de los clanes (las del juego, con el nivel dentro de la imagen).
//
// Se piden a Clash SOLO cuando hace falta, no a diario:
//  - al EMPEZAR una guerra (el nivel del clan sube con la XP de guerra, asi
//    que es cuando puede haber cambiado): una guerra normal nueva para el
//    clan principal, o una liga de CWL nueva para el clan que la juega;
//  - si falta alguna (primera vez, o tras cambiar un tag en Ajustes).
// Solo se pide la del clan afectado (1 peticion), nunca las dos por defecto.
//
// Las pide el CRON (api/sync.js), no la lectura de la config: pedirlas a
// Clash en medio de la carga de la app la dejaba esperando (con el proxy de
// Render dormido, hasta un minuto).
const redis = require("../redis");
const { getClanInfo } = require("./cocProxy");

const KEY = "cwl-clan-config";
const RETRY_MS = 10 * 60 * 1000; // si Clash falla, no insistir en cada ejecucion

const parse = (raw) => (raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null);

const CLANS = {
  main: { tagKey: "mainTag", badgeKey: "mainBadge" },
  secondary: { tagKey: "secondaryTag", badgeKey: "secondaryBadge" },
};

/**
 * @param {object} config configuracion de clanes (cwl-clan-config)
 * @param {object} opts
 * @param {Array<"main"|"secondary">} opts.clans clanes cuya guerra acaba de empezar
 * @returns {Promise<boolean>} true si hizo alguna peticion
 */
const refreshBadgesIfDue = async (config, { clans = [], now = Date.now() } = {}) => {
  if (!config) return false;
  const want = new Set(clans);
  Object.entries(CLANS).forEach(([key, { tagKey, badgeKey }]) => {
    if (config[tagKey] && !config[badgeKey]) want.add(key);
  });
  const targets = [...want].filter((key) => config[CLANS[key].tagKey]);
  if (targets.length === 0) return false;
  if (config.badgesTriedAt && now - config.badgesTriedAt < RETRY_MS) return false;

  const found = {};
  let failed = false;
  for (const key of targets) {
    const { tagKey, badgeKey } = CLANS[key];
    try {
      const info = await getClanInfo(config[tagKey]);
      const url = info && info.badgeUrls && (info.badgeUrls.medium || info.badgeUrls.large);
      if (url) found[badgeKey] = url;
      else failed = true;
    } catch (err) {
      failed = true;
      console.error("Badge refresh error:", err.message);
    }
  }

  // Se vuelve a leer justo antes de escribir y solo se tocan los campos de
  // insignia: asi no se pisa un cambio de nombres/tags hecho mientras tanto.
  const latest = parse(await redis.get(KEY)) || config;
  const next = { ...latest, ...found };
  if (Object.keys(found).length > 0) next.badgesAt = now;
  if (failed) next.badgesTriedAt = now;
  else delete next.badgesTriedAt;
  await redis.set(KEY, JSON.stringify(next));
  return true;
};

module.exports = { refreshBadgesIfDue };
