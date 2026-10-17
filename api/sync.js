const redis = require("./redis");
const { getClanMembers, getCurrentWar, getPlayer, normalizeTag } = require("./_lib/cocProxy");
const { buildNormalWarRecord } = require("./_lib/normalWarStats");
const {
  parseApiDate,
  scheduleOneTimeCheck,
  deleteScheduledJob,
  getLastScheduleError,
} = require("./_lib/cronJobOrg");
const { readJson, finalizeIfNew, touchRoster } = require("./_lib/normalWarStore");
const { syncCwlForClan } = require("./_lib/cwlSyncServer");

// Margen tras el endTime real antes de la comprobacion puntual: da tiempo a
// que el estado de la guerra en la API de Clash termine de asentarse.
const FOLLOW_UP_BUFFER_MS = 5 * 60 * 1000;
// Foto extra ANTES del final: si la comprobacion de despues falla, el
// rescate parte de una foto con casi todos los ataques y no de una de hace
// una hora.
const PRE_END_MARGIN_MS = 10 * 60 * 1000;
const syncStatusKey = (tag) => `sync-status:${tag}`;
// Margen para que la parte de CWL no agote los 10 s de las funciones de
// Vercel Hobby: pasado este punto no se piden mas guerras en esta ejecucion.
const CWL_TIME_BUDGET_MS = 7000;

const CLAN_CONFIG_KEY = "cwl-clan-config";
const progressKey = (tag) => `normal-wars-progress:${tag}`;

/**
 * Quien tiene warPreference "out" AHORA MISMO. Se llama UNA sola vez por
 * guerra, la primera vez que el cron la ve, y el resultado se congela en el
 * progreso (optOutTags): no se vuelve a consultar aunque alguien cambie su
 * estado a mitad de guerra, porque lo que interesa es quien estaba en rojo al
 * EMPEZAR. Es la unica fuente: la app ya no lo calcula por su cuenta.
 *
 * De 6 en 6: la API limita por segundo (~10 req/s), no por cuota mensual.
 */
const captureOptOuts = async (clanTag) => {
  const members = await getClanMembers(clanTag);
  const players = [];
  for (let i = 0; i < members.length; i += 6) {
    const chunk = members.slice(i, i + 6);
    const results = await Promise.allSettled(chunk.map((m) => getPlayer(m.tag)));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value?.warPreference === "out") {
        players.push({ tag: chunk[idx].tag, name: chunk[idx].name });
      }
    });
  }
  // Los jugadores opt-out NO estan en la alineacion de la guerra, asi que sus
  // nombres hay que guardarlos aqui (la guerra solo trae a los que juegan).
  return { tags: players.map((p) => p.tag), players, total: members.length };
};

/**
 * Guarda como registro (marcado `recoveredFromFallback`) la ULTIMA foto que
 * se tomo de una guerra que nunca llegamos a ver en estado warEnded, y limpia
 * su progreso y sus comprobaciones programadas. Una foto sin un solo ataque
 * (p. ej. solo se vio en preparacion) no es una guerra jugada: se descarta.
 */
const finalizeFromSnapshot = async (tag, progress) => {
  const record = buildNormalWarRecord(progress.lastWar, tag, progress.optOutTags);
  if (record) {
    record.recoveredFromFallback = true;
    record.fallbackReason = `never observed as warEnded; last seen state was "${progress.lastSeenState}"`;
  }
  const hasAttacks = (record?.us?.players || []).some((pl) => pl.attacks.length > 0);
  const saved = hasAttacks ? await finalizeIfNew(tag, record) : false;
  await deleteScheduledJob(progress.scheduledFollowUp?.jobId);
  await deleteScheduledJob(progress.scheduledPreEnd?.jobId);
  await redis.del(progressKey(tag));
  return { hasAttacks, saved, warKey: progress.warKey };
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

  // Foto del roster para la gracia de "ha salido del clan" (ver
  // touchRoster). Es una peticion mas por ejecucion; si falla no debe
  // impedir el resto del sync.
  try {
    await touchRoster(tag, await getClanMembers(tag));
  } catch (err) {
    console.error("Roster snapshot error:", err);
  }

  // Lanza error si la API/el proxy fallan (ver getCurrentWar): un fallo
  // puntual NO debe tomarse por "no hay guerra". El error llega al handler,
  // que lo anota en el indicador "Last sync", y la proxima ejecucion reintenta.
  const war = await getCurrentWar(tag);
  const progress = await readJson(progressKey(tag), null);

  if (!war) {
    if (progress?.lastWar) {
      // La API dice "notInWar" pero la guerra que seguiamos aun no deberia
      // haber terminado: puede ser un glitch. Se espera UNA ejecucion mas
      // antes de darla por desaparecida; si reaparece, el progreso se
      // reescribe sin la marca y todo sigue normal.
      const endDate = parseApiDate(progress.lastWar.endTime);
      if (endDate && endDate.getTime() > Date.now() && !progress.missingSince) {
        await redis.set(progressKey(tag), JSON.stringify({ ...progress, missingSince: Date.now() }));
        return {
          clan: label,
          status: "no-war (war vanished before its end time; waiting one more run to confirm)",
          warKey: progress.warKey,
        };
      }
      const out = await finalizeFromSnapshot(tag, progress);
      return {
        clan: label,
        status: !out.hasAttacks
          ? "no-war (discarded previous war: no attacks were ever recorded)"
          : out.saved === "upgraded"
          ? "no-war (replaced an earlier partial copy with the last snapshot)"
          : out.saved
          ? "no-war (recovered previous war from last snapshot, may be incomplete)"
          : "no-war (previous war already finalized)",
        warKey: progress.warKey,
      };
    }
    return { clan: label, status: "no-war" };
  }

  // Guerra NUEVA mientras seguiamos otra que nunca llegamos a ver terminada
  // (guerras seguidas: la anterior desaparece de currentwar en cuanto empieza
  // la siguiente). Antes se descartaba sin mas; ahora se guarda con su
  // ultima foto, marcada como parcial.
  const warKey = war.preparationStartTime || war.startTime;
  let previous = null;
  if (progress?.lastWar && progress.warKey !== warKey) {
    previous = await finalizeFromSnapshot(tag, progress);
  }

  const isSameWar = progress?.warKey === warKey;
  let optOutTags = isSameWar ? progress.optOutTags : null;
  let optOutCapturedAt = isSameWar ? progress.optOutCapturedAt : null;
  let optOutPlayers = isSameWar ? progress.optOutPlayers : null;
  let optOutTotal = isSameWar ? progress.optOutTotal : null;

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
    const captured = await captureOptOuts(tag);
    optOutTags = captured.tags;
    optOutPlayers = captured.players;
    optOutTotal = captured.total;
    optOutCapturedAt = Date.now();
  }

  // Anclaje: en cuanto se conoce el endTime real de la guerra (disponible
  // desde preparation, no hace falta esperar a inWar), se programa UNA
  // comprobacion puntual en cron-job.org poco despues de ese instante, en
  // vez de fiarlo todo a la cadencia fija del cron externo. Solo se crea
  // una vez por warKey (isSameWar + ya tenia scheduledFollowUp = no-op).
  let scheduleError = null;
  let scheduledFollowUp = isSameWar ? progress.scheduledFollowUp : null;
  if (!scheduledFollowUp && war.endTime && baseUrl && clanKey) {
    const endDate = parseApiDate(war.endTime);
    if (endDate) {
      const when = new Date(endDate.getTime() + FOLLOW_UP_BUFFER_MS);
      const followUpUrl = `${baseUrl}/api/sync?clan=${clanKey}&secret=${encodeURIComponent(process.env.CRON_SECRET)}`;
      const jobId = await scheduleOneTimeCheck(followUpUrl, when);
      if (jobId) scheduledFollowUp = { warKey, jobId };
      else scheduleError = getLastScheduleError();
    }
  }

  // Segunda comprobacion puntual, 10 min ANTES del final. Solo si aun no
  // existe para esta guerra y ese instante todavia esta por llegar (una
  // guerra ya casi terminada, o vista por primera vez tarde, no la crea).
  let scheduledPreEnd = isSameWar ? progress.scheduledPreEnd : null;
  if (!scheduledPreEnd && war.endTime && baseUrl && clanKey) {
    const endDate = parseApiDate(war.endTime);
    if (endDate) {
      const when = new Date(endDate.getTime() - PRE_END_MARGIN_MS);
      if (when.getTime() > Date.now() + 60 * 1000) {
        const preEndUrl = `${baseUrl}/api/sync?clan=${clanKey}&secret=${encodeURIComponent(process.env.CRON_SECRET)}`;
        const jobId = await scheduleOneTimeCheck(preEndUrl, when);
        if (jobId) scheduledPreEnd = { warKey, jobId };
        else scheduleError = getLastScheduleError();
      }
    }
  }

  // Foto de seguridad en CADA ejecucion mientras la guerra sigue viva, no
  // solo al final: si el estado warEnded se nos escapa entre dos ticks
  // (ver arriba), esta es la red de la que se puede rescatar.
  await redis.set(
    progressKey(tag),
    JSON.stringify({ warKey, optOutTags, optOutPlayers, optOutTotal, optOutCapturedAt, lastWar: war, lastSeenState: war.state, scheduledFollowUp, scheduledPreEnd, scheduleError })
  );

  if (war.state !== "warEnded") {
    return {
      clan: label,
      status: `tracking (${war.state})`,
      warKey,
      // Comprobaciones puntuales programadas en cron-job.org para esta guerra.
      anchoring: !process.env.CRONJOB_API_KEY
        ? "disabled: CRONJOB_API_KEY is not set"
        : scheduledFollowUp || scheduledPreEnd
        ? `scheduled (${[scheduledPreEnd && "before end", scheduledFollowUp && "after end"].filter(Boolean).join(" + ")})`
        : `not scheduled${scheduleError ? `: ${scheduleError}` : ""}`,
      // Si al aparecer esta guerra se guardo la anterior (guerras seguidas).
      ...(previous ? { previous } : {}),
    };
  }

  const record = buildNormalWarRecord(war, tag, optOutTags);
  if (!record) return { clan: label, status: "error-building-record", warKey };

  const saved = await finalizeIfNew(tag, record);
  await deleteScheduledJob(scheduledFollowUp?.jobId);
  await deleteScheduledJob(scheduledPreEnd?.jobId);
  await redis.del(progressKey(tag));

  return {
    clan: label,
    status:
      saved === "upgraded"
        ? "finalized (replaced an earlier partial copy)"
        : saved
        ? "finalized"
        : "already-finalized",
    warKey,
    result: record.result,
    ...(previous ? { previous } : {}),
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
 * Cada ejecucion hace dos cosas por clan: (1) sigue la guerra normal y
 * (2) sincroniza la CWL (api/_lib/cwlSyncServer.js): crea la temporada del
 * mes cuando aparece el grupo y va incorporando cada ronda al terminar. En
 * la respuesta, `cwl.status` dice que paso.
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

  const startedAt = Date.now();
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
      let result;
      if (clanKey === "secondary") {
        // El clan secundario solo juega CWL: no tiene guerras normales que
        // seguir, asi que no se piden ni sus miembros ni su guerra actual.
        result = { clan: label, status: "skipped (normal wars are tracked for the main clan only)" };
      } else {
        try {
          result = await syncClan(tag, label, clanKey, baseUrl);
        } catch (err) {
          console.error(`Sync error for ${label}:`, err);
          result = { clan: label, status: "error", error: err.message };
        }
      }
      // CWL: se crea la temporada sola cuando aparece el grupo y cada ronda
      // se incorpora al terminar. Va DESPUES de las guerras normales y con
      // un tope de tiempo: el trabajo pesado de una y otra casi nunca
      // coincide (en CWL no hay guerras normales), pero si coincidiera, lo
      // que quede se completa en la ejecucion siguiente.
      try {
        result.cwl = await syncCwlForClan({
          tag,
          clanKey,
          deadline: startedAt + CWL_TIME_BUDGET_MS,
        });
      } catch (err) {
        console.error(`CWL sync error for ${label}:`, err);
        result.cwl = { status: "error", error: err.message };
      }
      results.push(result);
      // Ultima ejecucion (bien o mal), para el indicador "Last sync" de la
      // UI: permite ver el mismo dia que el cron dejo de correr.
      try {
        await redis.set(
          syncStatusKey(normalizeTag(tag)),
          JSON.stringify({
            at: Date.now(),
            status: result.status,
            error: result.error || null,
            cwl: result.cwl ? result.cwl.status : null,
            cwlError: result.cwl?.error || null,
          })
        );
      } catch (e) {
        console.error("Sync status write error:", e);
      }
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Sync failed", details: err.message });
  }
}
