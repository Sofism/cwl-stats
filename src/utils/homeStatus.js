import { getCurrentWar, getClanMembers, normalizeTag } from "./cocApi";
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

  return {
    state: war.state,
    teamSize: war.teamSize,
    endTime: war.endTime,
    startTime: war.startTime,
    us: {
      name: us.name,
      stars: us.stars || 0,
      destruction: us.destructionPercentage || 0,
    },
    them: {
      name: them.name,
      stars: them.stars || 0,
      destruction: them.destructionPercentage || 0,
    },
    pending,
    pendingAttacks: pending.reduce((n, m) => n + m.left, 0),
  };
};

/**
 * Compara el roster actual con el ultimo guardado y devuelve altas y bajas.
 * El snapshot anterior vive en localStorage: es por dispositivo, no
 * compartido. Cuando exista el cron esto pasara a Redis y sera global.
 */
const ROSTER_KEY = "cwl_last_roster";

const diffRoster = (members) => {
  const current = members.map((m) => ({ tag: m.tag, name: m.name }));
  let previous = [];
  try {
    previous = JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]");
  } catch {
    previous = [];
  }

  // La primera vez no hay con que comparar: se guarda y no se inventan
  // altas (si no, los 50 miembros apareceran como "nuevos").
  const isFirstRun = previous.length === 0;
  const prevTags = new Set(previous.map((p) => p.tag));
  const currTags = new Set(current.map((p) => p.tag));

  const joined = isFirstRun ? [] : current.filter((p) => !prevTags.has(p.tag));
  const left = isFirstRun ? [] : previous.filter((p) => !currTags.has(p.tag));

  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(current));
  } catch {
    // Sin localStorage (modo privado): simplemente no hay historico.
  }

  return { joined, left, isFirstRun };
};

/**
 * Todo lo que el home necesita, en una sola llamada. Cada bloque falla de
 * forma independiente: que no haya CWL no impide mostrar la guerra normal.
 */
export const getHomeStatus = async (clanTag) => {
  if (!clanTag) return null;

  const [cwlRes, warRes, membersRes] = await Promise.allSettled([
    getCurrentCwlWar(clanTag),
    getCurrentWar(clanTag),
    getClanMembers(clanTag),
  ]);

  const cwlWar = cwlRes.status === "fulfilled" ? cwlRes.value : null;
  const regularWar = warRes.status === "fulfilled" ? warRes.value : null;
  const members = membersRes.status === "fulfilled" ? membersRes.value : [];

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
      }
    : null;

  return {
    cwl,
    regularWar: summarizeWar(regularWar, clanTag),
    roster: {
      size: members.length,
      ...diffRoster(members),
    },
    checkedAt: Date.now(),
  };
};
