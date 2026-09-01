const redis = require("./redis");
const { getClanMembers, getCurrentWar, getPlayer, normalizeTag } = require("./_lib/cocProxy");
const { buildNormalWarRecord } = require("./_lib/normalWarStats");

const CLAN_CONFIG_KEY = "cwl-clan-config";
const finalizedKey = (tag) => `normal-wars:${tag}`;
const progressKey = (tag) => `normal-wars-progress:${tag}`;

const readJson = async (key, fallback) => {
  const data = await redis.get(key);
  if (!data) return fallback;
  return typeof data === "string" ? JSON.parse(data) : data;
};

/**
 * Quien tiene warPreference "out" AHORA MISMO. Es la misma logica que
 * captureOptOutsForWar en src/utils/homeStatus.js, movida al servidor para
 * que la foto sea compartida entre dispositivos y no dependa de que
 * alguien tenga la app abierta cuando empieza la guerra.
 *
 * De 6 en 6: la API limita por segundo (~10 req/s), no por cuota mensual.
 */
const captureOptOuts = async (clanTag) => {
  const members = await getClanMembers(clanTag);
  const outTags = [];
  for (let i = 0; i < members.length; i += 6) {
    const chunk = members.slice(i, i + 6);
    const results = await Promise.allSettled(chunk.map((m) => getPlayer(m.tag)));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value?.warPreference === "out") {
        outTags.push(chunk[idx].tag);
      }
    });
  }
  return outTags;
};

/**
 * Sincroniza UN clan. Se llama una vez por invocacion por cada clan que
 * corresponda procesar (ver `handler` mas abajo sobre por que conviene
 * separarlos en dos llamadas del scheduler externo).
 */
const syncClan = async (clanTag, label) => {
  const tag = normalizeTag(clanTag);
  const war = await getCurrentWar(tag);
  const progress = await readJson(progressKey(tag), null);

  if (!war) {
    // Sin guerra activa ahora mismo. Si quedaba un "en progreso" es porque
    // el propio warEnded ya se proceso en un tick anterior (se borra al
    // finalizar, ver abajo); no hay nada pendiente que hacer aqui.
    return { clan: label, status: "no-war" };
  }

  const warKey = war.preparationStartTime || war.startTime;
  let optOutTags = progress?.warKey === warKey ? progress.optOutTags : null;

  if (optOutTags === null || optOutTags === undefined) {
    // Guerra nueva para nosotros (o primera vez que corre el cron): se
    // congela quien esta OUT en este instante. Es la referencia para toda
    // la guerra, no se vuelve a recalcular aunque alguien cambie su
    // preferencia luego.
    //
    // Caso raro sin solucion posible: si la PRIMERA vez que el cron ve un
    // clan la guerra ya esta en inWar o warEnded (por ejemplo, recien
    // desplegado el cron), esta foto no sera "al empezar la guerra" sino
    // "ahora mismo": la API no expone cuando cambio warPreference, asi que
    // no hay forma de reconstruir el estado real de ese momento. Solo
    // afecta a la primera guerra vista tras activar el cron.
    optOutTags = await captureOptOuts(tag);
    await redis.set(progressKey(tag), JSON.stringify({ warKey, optOutTags }));
  }

  if (war.state !== "warEnded") {
    return { clan: label, status: `tracking (${war.state})`, warKey };
  }

  const finalized = await readJson(finalizedKey(tag), []);
  if (finalized.some((w) => w.warKey === warKey)) {
    // Ya procesada en un tick anterior: no-op, idempotente.
    return { clan: label, status: "already-finalized", warKey };
  }

  const record = buildNormalWarRecord(war, tag, optOutTags);
  if (!record) return { clan: label, status: "error-building-record", warKey };

  finalized.push(record);
  await redis.set(finalizedKey(tag), JSON.stringify(finalized));
  await redis.del(progressKey(tag));

  return { clan: label, status: "finalized", warKey, result: record.result };
};

/**
 * Endpoint de cron para guerras normales. Pensado para ser llamado por un
 * programador EXTERNO (cron-job.org o GitHub Actions), cada hora: Vercel
 * Hobby limita su propio cron a 1x/dia, insuficiente para un ciclo de
 * guerra de ~48h.
 *
 * IMPORTANTE: llamar con ?clan=main y ?clan=secondary por separado (dos
 * jobs distintos en el scheduler), no sin parametro. Capturar opt-outs de
 * ~50 jugadores son ~9 tandas secuenciales de 6; hacer los DOS clanes en
 * la misma invocacion puede acercarse al limite de 10s de las funciones
 * de Vercel Hobby. Sin ?clan se procesan ambos (util solo para pruebas
 * manuales, no para el cron real).
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const secret = req.query?.secret || req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const configRaw = await redis.get(CLAN_CONFIG_KEY);
    const config = configRaw
      ? typeof configRaw === "string"
        ? JSON.parse(configRaw)
        : configRaw
      : null;

    if (!config?.mainTag && !config?.secondaryTag) {
      return res.status(200).json({ error: "No clan tags configured yet" });
    }

    const which = req.query?.clan;
    const targets = [];
    if ((!which || which === "main") && config.mainTag) {
      targets.push([config.mainTag, config.main || "Main"]);
    }
    if ((!which || which === "secondary") && config.secondaryTag) {
      targets.push([config.secondaryTag, config.secondary || "Secondary"]);
    }

    const results = [];
    for (const [tag, label] of targets) {
      // Secuencial a proposito: no duplicar carga sobre el proxy a la vez
      // y repartir mejor el presupuesto de tiempo de la funcion. Cada
      // clan falla de forma independiente (un timeout de red en uno no
      // debe impedir que el otro se procese ni tumbar la respuesta).
      try {
        results.push(await syncClan(tag, label));
      } catch (err) {
        console.error(`Sync error for ${label}:`, err);
        results.push({ clan: label, status: "error", error: err.message });
      }
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Sync failed", details: err.message });
  }
}
