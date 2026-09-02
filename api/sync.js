const redis = require("./redis");
const { getClanMembers, getCurrentWar, getPlayer, normalizeTag } = require("./_lib/cocProxy");
const { buildNormalWarRecord } = require("./_lib/normalWarStats");
const { parseApiDate, scheduleOneTimeCheck, deleteScheduledJob } = require("./_lib/cronJobOrg");
const { readJson, finalizeIfNew } = require("./_lib/normalWarStore");

// Margen tras el endTime real antes de la comprobacion puntual: da tiempo a
// que el estado de la guerra en la API de Clash termine de asentarse.
const FOLLOW_UP_BUFFER_MS = 5 * 60 * 1000;

const CLAN_CONFIG_KEY = "cwl-clan-config";
const progressKey = (tag) => `normal-wars-progress:${tag}`;

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
 *
 * @param {string} clanKey - "main" | "secondary", para reconstruir la URL
 *   de la comprobacion puntual (?clan=...) al programarla en cron-job.org.
 * @param {string} baseUrl - origen de esta misma app (https://host), para
 *   esa misma URL. null si no se pudo determinar (se omite el anclaje).
 */
const syncClan = async (clanTag, label, clanKey, baseUrl) => {
  const tag = normalizeTag(clanTag);
  const war = await getCurrentWar(tag);
  const progress = await readJson(progressKey(tag), null);

  if (!war) {
    if (progress?.lastWar) {
      // La guerra que seguiamos desaparecio de currentwar SIN pasar por
      // warEnded (la API de Clash solo expone la guerra actual). En vez de
      // perderla del todo, se rescata con la ULTIMA foto que se guardo
      // mientras seguia viva: puede faltarle algun ataque de los ultimos
      // minutos si la ultima foto fue en "inWar", pero es mucho mejor que
      // nada. Se marca explicitamente para poder distinguirla despues.
      const record = buildNormalWarRecord(progress.lastWar, tag, progress.optOutTags);
      if (record) {
        record.recoveredFromFallback = true;
        record.fallbackReason = `never observed as warEnded; last seen state was "${progress.lastSeenState}"`;
      }
      const saved = await finalizeIfNew(tag, record);
      await deleteScheduledJob(progress.scheduledFollowUp?.jobId);
      await redis.del(progressKey(tag));
      return {
        clan: label,
        status: saved
          ? "no-war (recovered previous war from last snapshot, may be incomplete)"
          : "no-war (previous war already finalized)",
        warKey: progress.warKey,
      };
    }
    return { clan: label, status: "no-war" };
  }

  const warKey = war.preparationStartTime || war.startTime;
  const isSameWar = progress?.warKey === warKey;
  let optOutTags = isSameWar ? progress.optOutTags : null;

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
  }

  // Anclaje: en cuanto se conoce el endTime real de la guerra (disponible
  // desde preparation, no hace falta esperar a inWar), se programa UNA
  // comprobacion puntual en cron-job.org poco despues de ese instante, en
  // vez de fiarlo todo a la cadencia fija del cron externo. Solo se crea
  // una vez por warKey (isSameWar + ya tenia scheduledFollowUp = no-op).
  let scheduledFollowUp = isSameWar ? progress.scheduledFollowUp : null;
  if (!scheduledFollowUp && war.endTime && baseUrl && clanKey) {
    const endDate = parseApiDate(war.endTime);
    if (endDate) {
      const when = new Date(endDate.getTime() + FOLLOW_UP_BUFFER_MS);
      const followUpUrl = `${baseUrl}/api/sync?clan=${clanKey}&secret=${encodeURIComponent(process.env.CRON_SECRET)}`;
      const jobId = await scheduleOneTimeCheck(followUpUrl, when);
      if (jobId) scheduledFollowUp = { warKey, jobId };
    }
  }

  // Foto de seguridad en CADA ejecucion mientras la guerra sigue viva, no
  // solo al final: si el estado warEnded se nos escapa entre dos ticks
  // (ver arriba), esta es la red de la que se puede rescatar.
  await redis.set(
    progressKey(tag),
    JSON.stringify({ warKey, optOutTags, lastWar: war, lastSeenState: war.state, scheduledFollowUp })
  );

  if (war.state !== "warEnded") {
    return { clan: label, status: `tracking (${war.state})`, warKey };
  }

  const record = buildNormalWarRecord(war, tag, optOutTags);
  if (!record) return { clan: label, status: "error-building-record", warKey };

  const saved = await finalizeIfNew(tag, record);
  await deleteScheduledJob(scheduledFollowUp?.jobId);
  await redis.del(progressKey(tag));

  return {
    clan: label,
    status: saved ? "finalized" : "already-finalized",
    warKey,
    result: record.result,
  };
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
 *
 * Ademas del cron periodico, en cuanto se conoce el endTime real de una
 * guerra se programa (via la API de cron-job.org, CRONJOB_API_KEY) una
 * comprobacion puntual justo despues de que termine, para no depender solo
 * de que la cadencia fija del cron externo coincida con el instante exacto
 * en que la API de Clash todavia muestra warEnded. Si CRONJOB_API_KEY no
 * esta configurada, este anclaje simplemente no se activa.
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

    // Host de esta misma app, para construir la URL de la comprobacion
    // puntual que se programa en cron-job.org (ver syncClan). Si por lo
    // que sea no viene el header, se omite el anclaje sin romper el resto.
    const baseUrl = req.headers.host ? `https://${req.headers.host}` : null;

    const which = req.query?.clan;
    const targets = [];
    if ((!which || which === "main") && config.mainTag) {
      targets.push([config.mainTag, config.main || "Main", "main"]);
    }
    if ((!which || which === "secondary") && config.secondaryTag) {
      targets.push([config.secondaryTag, config.secondary || "Secondary", "secondary"]);
    }

    const results = [];
    for (const [tag, label, clanKey] of targets) {
      // Secuencial a proposito: no duplicar carga sobre el proxy a la vez
      // y repartir mejor el presupuesto de tiempo de la funcion. Cada
      // clan falla de forma independiente (un timeout de red en uno no
      // debe impedir que el otro se procese ni tumbar la respuesta).
      try {
        results.push(await syncClan(tag, label, clanKey, baseUrl));
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
