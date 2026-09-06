import { getCurrentWar, getClanMembers, getPlayer, normalizeTag } from "./cocApi";
import { getCurrentCwlWar } from "./cwlSync";

/**
 * Resume una guerra (CWL o normal) a lo que el home necesita mostrar:
 * marcador, estado y quien no ha atacado todavia.
 */
const summarizeWar = (war, clanTag) => {
  if (!war) return null;
  const tag = normalizeTag(clanTag);
  const isHome = war.clan?.tag === tag;
  const us = isHome ? war.clan : war.opponent;
  const them = isHome ? war.opponent : war.clan;
  if (!us || !them) return null;

  const attacksPerMember = war.attacksPerMember || 2;
  const pending = (us.members || [])
    .map((m) => ({
      name: m.name,
      position: m.mapPosition,
      used: (m.attacks || []).length,
      left: attacksPerMember - (m.attacks || []).length,
    }))
    .filter((m) => m.left > 0)
    .sort((a, b) => a.position - b.position);

  const totalAttacks = war.teamSize * attacksPerMember;
  const usAttacksUsed = (us.members || []).reduce((n, m) => n + (m.attacks || []).length, 0);
  const themAttacksUsed = (them.members || []).reduce((n, m) => n + (m.attacks || []).length, 0);

  // Defensa por bando: para cada base de "defendingSide", el PEOR ataque
  // que recibio de "attackingSide" (0-3 estrellas). "Holding" = las que se
  // quedaron por debajo de 3 (sin tocar cuenta igual que aguantar con 1 o
  // 2 estrellas - 0 estrellas exactas es demasiado raro para ser la barra,
  // lo que importa es no llegar al 3-star). oneStarConceded/
  // twoStarConceded desglosan cuantas de esas se quedaron justo en 1 o 2.
  const defenseBreakdown = (defendingSide, attackingSide) => {
    const worstByDefender = new Map();
    (attackingSide.members || [])
      .flatMap((m) => m.attacks || [])
      .forEach((a) => {
        const current = worstByDefender.get(a.defenderTag);
        if (current === undefined || a.stars > current) worstByDefender.set(a.defenderTag, a.stars);
      });
    const worstValues = [...worstByDefender.values()];
    const threeStarred = worstValues.filter((stars) => stars >= 3).length;
    return {
      holding: (defendingSide.members || []).length - threeStarred,
      oneStarConceded: worstValues.filter((stars) => stars === 1).length,
      twoStarConceded: worstValues.filter((stars) => stars === 2).length,
    };
  };
  const usDefense = defenseBreakdown(us, them);
  const themDefense = defenseBreakdown(them, us);

  return {
    state: war.state,
    teamSize: war.teamSize,
    endTime: war.endTime,
    startTime: war.startTime,
    // Identificador estable de esta guerra concreta.
    warKey: war.preparationStartTime || war.startTime || null,
    attacksPerMember,
    usAttacksUsed,
    usAttacksLeft: totalAttacks - usAttacksUsed,
    themAttacksUsed,
    themAttacksLeft: totalAttacks - themAttacksUsed,
    usBasesHolding: usDefense.holding,
    themBasesHolding: themDefense.holding,
    usOneStarConceded: usDefense.oneStarConceded,
    usTwoStarConceded: usDefense.twoStarConceded,
    themOneStarConceded: themDefense.oneStarConceded,
    themTwoStarConceded: themDefense.twoStarConceded,
    starsLeft: war.teamSize * 3 - (us.stars || 0),
    us: {
      tag: us.tag,
      name: us.name,
      stars: us.stars || 0,
      destruction: us.destructionPercentage || 0,
    },
    them: {
      tag: them.tag,
      name: them.name,
      stars: them.stars || 0,
      destruction: them.destructionPercentage || 0,
    },
    pending,
    pendingAttacks: pending.reduce((n, m) => n + m.left, 0),
  };
};

/**
 * Todo lo que el home necesita, en una sola llamada. Cada bloque falla de
 * forma independiente: que no haya CWL no impide mostrar la guerra normal.
 */
export const getHomeStatus = async (clanTag) => {
  if (!clanTag) return null;

  const [cwlRes, warRes] = await Promise.allSettled([
    getCurrentCwlWar(clanTag),
    getCurrentWar(clanTag),
  ]);

  const cwlWar = cwlRes.status === "fulfilled" ? cwlRes.value : null;
  const regularWar = warRes.status === "fulfilled" ? warRes.value : null;

  // getCurrentCwlWar ya devuelve su propio formato con roster resuelto.
  const cwl = cwlWar
    ? {
        state: cwlWar.state,
        teamSize: cwlWar.teamSize,
        endTime: cwlWar.endTime,
        startTime: cwlWar.startTime,
        us: {
          name: cwlWar.us.name,
          stars: cwlWar.us.stars,
          destruction: cwlWar.us.destruction,
        },
        them: {
          name: cwlWar.them.name,
          stars: cwlWar.them.stars,
          destruction: cwlWar.them.destruction,
        },
        pending: cwlWar.roster
          .filter((p) => !p.hasAttacked)
          .map((p) => ({ name: p.name, position: p.position, left: 1 })),
        pendingAttacks: cwlWar.roster.filter((p) => !p.hasAttacked).length,
        attacksPerMember: cwlWar.attacksPerMember,
        usAttacksUsed: cwlWar.usAttacksUsed,
        usAttacksLeft: cwlWar.usAttacksLeft,
        themAttacksUsed: cwlWar.themAttacksUsed,
        themAttacksLeft: cwlWar.themAttacksLeft,
        ourBasesAttacked: cwlWar.ourBasesAttacked,
        ourBasesUntouched: cwlWar.ourBasesUntouched,
        perfectDefenses: cwlWar.perfectDefenses,
        starsLeft: cwlWar.starsLeft,
      }
    : null;

  return {
    cwl,
    regularWar: summarizeWar(regularWar, clanTag),
    checkedAt: Date.now(),
  };
};

/**
 * Quien tenia la guerra desactivada (escudo rojo) CUANDO EMPEZO una guerra
 * concreta. warPreference solo esta en el perfil individual, asi que son
 * ~50 peticiones: por eso se calcula UNA VEZ por guerra y se congela.
 *
 * La foto se guarda con la clave de la guerra (preparationStartTime, que
 * es unica). Mientras dure esa guerra se reutiliza; cuando empieza otra,
 * se vuelve a calcular. Asi refleja quien estaba fuera al arrancar, que es
 * la referencia para no esperar sus ataques.
 */
const OPTOUT_KEY = "cwl_war_optouts";

const readOptOutCache = () => {
  try {
    return JSON.parse(localStorage.getItem(OPTOUT_KEY) || "{}");
  } catch {
    return {};
  }
};

/** Foto ya calculada para esta guerra, si existe. Sin peticiones. */
export const getCachedOptOuts = (warKey) => {
  if (!warKey) return null;
  return readOptOutCache()[warKey] || null;
};

export const captureOptOutsForWar = async (clanTag, warKey) => {
  if (!warKey) return null;
  const cache = readOptOutCache();
  if (cache[warKey]) return cache[warKey];

  const members = await getClanMembers(clanTag);
  if (!members.length) return null;

  // De 6 en 6: la API limita por segundo (~10 req/s es la referencia
  // habitual), no por cuota mensual.
  const profiles = [];
  for (let i = 0; i < members.length; i += 6) {
    const chunk = members.slice(i, i + 6);
    const results = await Promise.allSettled(chunk.map((m) => getPlayer(m.tag)));
    results.forEach((r, idx) => {
      profiles.push({
        tag: chunk[idx].tag,
        name: chunk[idx].name,
        preference:
          r.status === "fulfilled" && r.value ? r.value.warPreference : null,
      });
    });
  }

  const snapshot = {
    warKey,
    capturedAt: Date.now(),
    total: profiles.length,
    players: profiles
      .filter((p) => p.preference === "out")
      .map((p) => ({ tag: p.tag, name: p.name })),
  };

  // Solo se conservan las ultimas 10 guerras para no llenar localStorage.
  const entries = Object.entries({ ...cache, [warKey]: snapshot })
    .sort((a, b) => b[1].capturedAt - a[1].capturedAt)
    .slice(0, 10);
  try {
    localStorage.setItem(OPTOUT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // sin persistencia: se recalculara la proxima vez
  }
  return snapshot;
};
