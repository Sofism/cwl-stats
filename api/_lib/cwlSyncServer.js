// Sincronizacion AUTOMATICA de la CWL, lanzada por api/sync.js (el mismo
// cron externo que ya sigue las guerras normales). Hace tres cosas:
//
//  1. Cada ronda se incorpora en cuanto TERMINA (las guerras en curso no
//     suman nada), igual que la sincronizacion manual del cliente.
//  2. La temporada se CREA SOLA cuando aparece el grupo de CWL, usando
//     group.season como identidad: nunca se mezcla un mes con otro.
//  3. Es incremental: las guerras terminadas no cambian, asi que se guardan
//     en Redis y no se vuelven a pedir. Una ejecucion normal son 1-5
//     peticiones en vez de las ~30 de una sincronizacion completa.
//
// Motivo de existir: la API de Clash solo expone la CWL EN CURSO, y (segun
// Santi) el grupo desaparece en cuanto el clan empieza otra guerra. Sin
// captura periodica, lo que no se sincronizo a mano a tiempo se perdia.
const redis = require("../redis");
const {
  normalizeTag,
  getClanInfo,
  getLeagueGroup,
  getLeagueWar,
} = require("./cocProxy");
const { didWeWin, rankGroupClans, aggregateCwlPlayers } = require("./cwlAggregate");
const link = require("./cwlSeasonLink");
const store = require("./seasonStore");
const { parseApiDate, scheduleOneTimeCheck, deleteScheduledJob, getLastScheduleError } = require("./cronJobOrg");

const stateKey = (tag) => `cwl-state:${tag}`;
const BATCH_SIZE = 6;
// Comprobacion puntual tras el final de cada ronda: el grupo de CWL
// desaparece de la API en cuanto el clan empieza una guerra normal, asi que si
// la ultima ronda termina y el cron horario aun no la ha visto, se perderia.
const ROUND_ANCHOR_AFTER_MS = 3 * 60 * 1000;

const readState = async (tag) => {
  const data = await redis.get(stateKey(tag));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
};

// De cada guerra solo se guarda lo que hace falta; el JSON crudo de la API
// trae mucho mas (aldeas, mejores ataques...) y son 28 guerras por liga.
const pruneAttacks = (attacks) =>
  (attacks || []).map((a) => ({
    attackerTag: a.attackerTag,
    defenderTag: a.defenderTag,
    stars: a.stars,
    destructionPercentage: a.destructionPercentage,
    order: a.order,
  }));

const pruneSide = (side, withMembers) => ({
  tag: side.tag,
  name: side.name,
  stars: side.stars || 0,
  destructionPercentage: side.destructionPercentage || 0,
  ...(withMembers
    ? {
        members: (side.members || []).map((m) => ({
          tag: m.tag,
          name: m.name,
          townhallLevel: m.townhallLevel,
          mapPosition: m.mapPosition,
          attacks: pruneAttacks(m.attacks),
        })),
      }
    : {}),
});

const pruneWar = (war, involvesUs) => ({
  state: war.state,
  teamSize: war.teamSize,
  endTime: war.endTime,
  clan: pruneSide(war.clan, involvesUs),
  opponent: pruneSide(war.opponent, involvesUs),
});

/**
 * Descarga (de forma incremental) el grupo de CWL del clan y calcula sus
 * estadisticas. Devuelve null si el clan no esta en ninguna CWL (404).
 * Lanza error si el proxy o la API de Clash fallan: NO es lo mismo que "no
 * esta en CWL", y confundirlos haria creer que no hay datos.
 */
const fetchCwlResult = async (clanTag, clanLabel, deadline, anchor) => {
  const tag = normalizeTag(clanTag);
  const grp = await getLeagueGroup(tag);
  if (grp.status === 404) return null;
  if (!grp.ok) throw new Error(`League group request failed (${grp.status})`);

  const group = grp.data;
  const key = link.seasonKeyFromGroup(group);
  if (!key || !Array.isArray(group.rounds)) {
    throw new Error(`Unexpected league group format (season "${group && group.season}")`);
  }

  let state = await readState(tag);
  if (state && state.season !== key && state.anchors) {
    // Liga nueva: las comprobaciones puntuales de la anterior ya no sirven.
    for (const a of Object.values(state.anchors)) await deleteScheduledJob(a.jobId);
  }
  const newLeague = !state || state.season !== key;
  if (newLeague) state = { season: key, wars: {}, teamSize: null, anchors: {} };
  // Una liga recien vista se guarda siempre (aunque aun no haya guerras que
  // anotar): si no, se volveria a tomar por nueva en cada ejecucion.
  let stateChanged = newLeague;

  const allTags = group.rounds.flatMap((r) => r.warTags).filter((t) => t && t !== "#0");
  const pending = allTags.filter((t) => !(state.wars[t] && state.wars[t].ended));

  let liveRounds = 0;
  let partial = false;
  const ourOpenWars = []; // guerras NUESTRAS aun sin terminar (con su hora de fin)
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (deadline && Date.now() > deadline) {
      partial = true;
      break;
    }
    const chunk = pending.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map((t) => getLeagueWar(t)));
    results.forEach((r, idx) => {
      if (!r.ok || !r.data) return;
      const war = r.data;
      const involvesUs = war.clan?.tag === tag || war.opponent?.tag === tag;
      if (involvesUs && war.teamSize) {
        if (state.teamSize !== war.teamSize) {
          state.teamSize = war.teamSize;
          stateChanged = true;
        }
      }
      if (war.state === "warEnded") {
        state.wars[chunk[idx]] = { ended: true, war: pruneWar(war, involvesUs) };
        stateChanged = true;
      } else if (involvesUs) {
        if (war.state === "inWar") liveRounds += 1;
        if (war.endTime) ourOpenWars.push({ warTag: chunk[idx], endTime: war.endTime });
      }
    });
  }
  // Comprobaciones puntuales de fin de ronda (cron-job.org): una por guerra
  // nuestra todavia abierta, 3 min despues de su hora de fin; se borran en
  // cuanto esa guerra queda guardada. Mejor esfuerzo: si falla, el cron
  // horario sigue siendo la red de seguridad.
  state.anchors = state.anchors || {};
  if (anchor && anchor.baseUrl && anchor.clanKey) {
    for (const { warTag, endTime } of ourOpenWars) {
      if (state.anchors[warTag]) continue;
      const end = parseApiDate(endTime);
      if (!end) continue;
      const when = new Date(end.getTime() + ROUND_ANCHOR_AFTER_MS);
      if (when.getTime() < Date.now() + 60 * 1000) continue;
      const url = `${anchor.baseUrl}/api/sync?clan=${anchor.clanKey}&secret=${encodeURIComponent(process.env.CRON_SECRET)}`;
      const jobId = await scheduleOneTimeCheck(
        url,
        when,
        `cwl-stats · ${anchor.clanKey} · CWL round check 3 min after its end (auto, deletes itself)`
      );
      if (jobId) {
        state.anchors[warTag] = { jobId, endTime };
        delete state.anchorError;
      } else {
        state.anchorError = getLastScheduleError();
      }
      stateChanged = true;
    }
  }
  for (const [warTag, a] of Object.entries(state.anchors)) {
    if (state.wars[warTag] && state.wars[warTag].ended) {
      await deleteScheduledJob(a.jobId);
      delete state.anchors[warTag];
      stateChanged = true;
    }
  }
  if (stateChanged) await redis.set(stateKey(tag), JSON.stringify(state));

  const endedAll = allTags
    .map((t) => state.wars[t])
    .filter((w) => w && w.ended)
    .map((w) => w.war);
  const ourEnded = endedAll
    .filter((w) => w.clan.tag === tag || w.opponent.tag === tag)
    .map((w) => {
      const isHome = w.clan.tag === tag;
      return { war: w, us: isHome ? w.clan : w.opponent, them: isHome ? w.opponent : w.clan };
    });

  const ranked = rankGroupClans(group, endedAll);
  const found = ranked.find((c) => c.tag === tag);
  const info = await getClanInfo(tag);

  return {
    key,
    groupState: group.state,
    players: aggregateCwlPlayers(ourEnded, clanLabel),
    league: (info && (info.warLeague?.name || info.clanWarLeague?.name)) || null,
    position: found ? found.rank : null,
    warsWon: ourEnded.filter(({ us, them }) => didWeWin(us, them)).length,
    warSize: state.teamSize || 15,
    roundsTotal: group.rounds.length,
    roundsCompleted: ourEnded.length,
    liveRounds,
    isComplete: ourEnded.length >= group.rounds.length,
    partial,
    anchors: Object.keys(state.anchors).length,
    newLeague,
  };
};

const newSeasonFor = (key) => {
  const now = Date.now();
  return {
    id: String(now),
    name: link.monthNameFromKey(key),
    year: link.yearFromKey(key),
    createdAt: new Date(now).toISOString(),
    cwlSeason: key,
    mainClan: [],
    secondaryClan: [],
    leagueInfo: {
      main: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
      secondary: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
    },
    updatedAt: now,
  };
};

/**
 * Escribe el resultado en la temporada que corresponda (la crea si no
 * existe). Reglas para no destrozar datos:
 *  - Solo toca la temporada vinculada a ESE mes (group.season).
 *  - Una temporada creada a mano antes de este sync se adopta, pero los
 *    clanes que ya tenian jugadores quedan marcados como `manual`: no se
 *    sobrescriben (podrian ser datos pegados a mano a proposito).
 *  - Un clan marcado `manual` no se toca; al pulsar "Sync now" en la app
 *    se sobrescribe y se quita la marca.
 *  - Cuando la liga esta completa se escribe una ultima vez y el clan se
 *    marca `cwlComplete`: a partir de ahi no se vuelve a tocar.
 *  - Nunca se escribe una lista con MENOS jugadores que la guardada (las
 *    rondas solo anaden jugadores).
 */
const applyToSeasons = async (clanKey, result) => {
  const playersField = clanKey === "main" ? "mainClan" : "secondaryClan";
  const atField = clanKey === "main" ? "mainAt" : "secondaryAt";

  return store.withLock(async () => {
    const seasons = await store.readSeasons();
    const deleted = await store.readDeleted();
    let season = link.findSeasonForKey(seasons, result.key);
    let action = "updated";
    let changed = false;

    if (!season) {
      // Si el usuario borro a proposito la temporada de este mes, no se
      // vuelve a crear sola (el grupo sigue visible en la API durante dias).
      if (deleted.includes(`cwl:${result.key}`)) {
        return { action: "skipped-deleted", seasonId: null, seasonName: null };
      }
      const created = newSeasonFor(result.key);
      seasons.unshift(created);
      season = created;
      action = "created";
      changed = true;
    } else if (!season.cwlSeason) {
      season.cwlSeason = result.key;
      const manual = { ...(season.manual || {}) };
      if ((season.mainClan || []).length > 0) manual.main = true;
      if ((season.secondaryClan || []).length > 0) manual.secondary = true;
      season.manual = manual;
      action = "adopted";
      changed = true;
    }

    const manualLocked = !!(season.manual && season.manual[clanKey]);
    const alreadyComplete = !!(season.cwlComplete && season.cwlComplete[clanKey]);

    if (manualLocked) {
      action = changed ? action : "skipped-manual";
    } else if (alreadyComplete) {
      action = changed ? action : "skipped-complete";
    } else if (result.partial) {
      // Datos a medias (se acabo el tiempo): se completa en la siguiente.
      action = changed ? action : "skipped-partial";
    } else {
      const existing = season[playersField] || [];
      if (result.players.length < existing.length) {
        action = changed ? action : "skipped-would-shrink";
      } else {
        const oldInfo = (season.leagueInfo && season.leagueInfo[clanKey]) || {};
        const newInfo = {
          league: result.league || oldInfo.league || "Crystal I",
          position: result.position || oldInfo.position || 1,
          warsWon: result.warsWon,
          warSize: result.warSize,
        };
        const dataChanged =
          JSON.stringify([existing, oldInfo]) !== JSON.stringify([result.players, newInfo]);
        if (dataChanged) {
          season[playersField] = result.players;
          season.leagueInfo = { ...(season.leagueInfo || {}), [clanKey]: newInfo };
          season[atField] = Date.now();
          changed = true;
        }
        if (result.isComplete) {
          season.cwlComplete = { ...(season.cwlComplete || {}), [clanKey]: true };
          season[atField] = Date.now();
          changed = true;
        }
        if (!changed) action = "unchanged";
      }
    }

    if (changed) {
      await store.snapshotSeasons(`before-cwl-sync-${clanKey}`);
      await store.writeSeasonsRaw(seasons);
    }
    return { action, seasonId: season.id, seasonName: season.name };
  });
};

/**
 * @param {object} p
 * @param {string} p.tag clan tag
 * @param {"main"|"secondary"} p.clanKey
 * @param {number} p.deadline timestamp (ms) tras el cual no se piden mas guerras
 */
const syncCwlForClan = async ({ tag, clanKey, deadline, baseUrl }) => {
  const label = clanKey === "main" ? "Main" : "Secondary";
  const result = await fetchCwlResult(tag, label, deadline, { clanKey, baseUrl });
  if (!result) return { status: "no-group" };
  const applied = await applyToSeasons(clanKey, result);
  return {
    status: applied.action,
    season: applied.seasonName,
    cwlSeason: result.key,
    groupState: result.groupState,
    rounds: `${result.roundsCompleted}/${result.roundsTotal}`,
    players: result.players.length,
    roundChecks: result.anchors,
    newLeague: result.newLeague,
  };
};

module.exports = { syncCwlForClan };
