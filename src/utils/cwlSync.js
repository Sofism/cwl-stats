import {
  getClanInfo,
  getClanMembers,
  getCurrentWarLeagueGroup,
  getClanWarLeagueWar,
  normalizeTag,
} from "./cocApi";
import { compareDefaultOrder } from "./playerOrder";

/**
 * Roster actual del clan, independiente de la CWL. Sirve para saber quién
 * está en el clan AHORA, sin depender de que haya una liga en curso.
 */
export const syncClanRoster = async (clanTag) => {
  const [info, members] = await Promise.all([
    getClanInfo(clanTag),
    getClanMembers(clanTag),
  ]);
  return {
    clanName: info?.name || null,
    members: members.map((m) => ({
      tag: m.tag,
      name: m.name,
      th: m.townHallLevel || m.townhallLevel || 0,
      role: m.role,
    })),
  };
};

// Penalización que se aplica cuando a un jugador NO le atacó nadie ese día
// de guerra. Es el mismo criterio que usaba la hoja de cálculo manual
// (dataParser.js): en vez de premiar "no me atacaron", se asume una defensa
// mala (2 estrellas / 85% destrucción) para no falsear las stats.
const UNPUNISHED_DEFENSE_STARS = 2;
const UNPUNISHED_DEFENSE_DEST = 85;

const isCompletedWar = (war) => war && war.state === "warEnded";
// Una guerra "viva" ya tiene ataques reales aunque no haya terminado.
// "preparation" se excluye: hay roster pero todavía no se puede atacar.
const isLiveWar = (war) => war && war.state === "inWar";

const didWeWin = (ourSide, theirSide) => {
  if (ourSide.stars !== theirSide.stars) return ourSide.stars > theirSide.stars;
  return ourSide.destructionPercentage > theirSide.destructionPercentage;
};

/**
 * Agrega las estadisticas por jugador a partir de guerras TERMINADAS.
 * `pairs` es una lista de { us, them } (los dos lados de cada guerra).
 * La clave es el tag, unico y estable aunque el jugador cambie de nombre.
 *
 * Se usa tanto para la temporada guardada como para la vista en vivo (de
 * nuestro clan y del rival), de modo que la formula es una sola.
 *
 * Con `withDetails` se anade ademas el detalle de cada defensa recibida;
 * se deja fuera de lo que se guarda en Redis para no inflar las temporadas.
 */
export const aggregatePlayers = (pairs, clanLabel, { withDetails = false } = {}) => {
  const byTag = new Map();

  const getPlayer = (member) => {
    if (!byTag.has(member.tag)) {
      byTag.set(member.tag, {
        tag: member.tag,
        name: member.name,
        clan: clanLabel,
        th: member.townhallLevel || 0,
        roosterDays: 0,
        missedAttacks: 0,
        offAttacks: [],
        offDestTotal: 0,
        atkSameOrHigherTh: 0,
        defAttacks: [],
        defenseLog: [],
        unpunishedDefenses: 0,
        distances: [],
      });
    }
    return byTag.get(member.tag);
  };

  pairs.forEach(({ us, them }) => {
    const enemyAttacks = (them.members || []).flatMap((m) =>
      (m.attacks || []).map((a) => ({ a, attacker: m }))
    );

    (us.members || []).forEach((member) => {
      const p = getPlayer(member);
      p.roosterDays += 1;
      p.name = member.name; // se queda con el nombre mas reciente
      if (member.townhallLevel) p.th = member.townhallLevel; // y el TH mas reciente

      const attack = (member.attacks || [])[0];
      if (attack) {
        p.offAttacks.push(attack.stars);
        p.offDestTotal += attack.destructionPercentage;
        const defender = (them.members || []).find((m) => m.tag === attack.defenderTag);
        if (defender) {
          // (posicion propia - posicion del objetivo). Ej: jugador en la
          // posicion 5 atacando en 20/25/30 -> (-15,-20,-25) -> media -20.
          p.distances.push(member.mapPosition - defender.mapPosition);
          // Ataque a un TH igual o superior al propio (criterio de desempate).
          if ((defender.townhallLevel || 0) >= (member.townhallLevel || 0)) {
            p.atkSameOrHigherTh += 1;
          }
        }
      } else {
        p.missedAttacks += 1;
      }

      // Defensas: ataques del OTRO clan cuyo objetivo fue este miembro.
      const faced = enemyAttacks.filter(({ a }) => a.defenderTag === member.tag);
      if (faced.length > 0) {
        faced.forEach(({ a, attacker }) => {
          p.defAttacks.push(a);
          if (withDetails) {
            p.defenseLog.push({
              stars: a.stars,
              destruction: a.destructionPercentage,
              attackerName: attacker.name,
              attackerTh: attacker.townhallLevel || 0,
              attackerPosition: attacker.mapPosition,
              targetTh: member.townhallLevel || 0,
              targetPosition: member.mapPosition,
            });
          }
        });
      } else {
        p.unpunishedDefenses += 1;
      }
    });
  });

  return Array.from(byTag.values()).map((p) => {
    const wars = p.roosterDays;
    const offStars = p.offAttacks.reduce((sum, s) => sum + s, 0);
    const offDest = p.offDestTotal;
    const missAtk = p.missedAttacks;

    const stars3 = p.offAttacks.filter((s) => s === 3).length;
    const stars2 = p.offAttacks.filter((s) => s === 2).length;
    const stars1 = p.offAttacks.filter((s) => s === 1).length;
    const stars0 = p.offAttacks.filter((s) => s === 0).length;

    const defStarsFaced = p.defAttacks.reduce((sum, a) => sum + a.stars, 0);
    const defDestFaced = p.defAttacks.reduce((sum, a) => sum + a.destructionPercentage, 0);
    const missDef = p.unpunishedDefenses;

    const defStars = defStarsFaced + missDef * UNPUNISHED_DEFENSE_STARS;
    const defDest = defDestFaced + missDef * UNPUNISHED_DEFENSE_DEST;

    const avgDistance =
      p.distances.length > 0
        ? p.distances.reduce((sum, d) => sum + d, 0) / p.distances.length
        : 0;

    const player = {
      name: p.name,
      tag: p.tag,
      clan: p.clan,
      th: p.th,
      missAtk,
      offStars,
      offDest,
      defStars,
      defDest,
      netStars: offStars - defStars,
      netDest: offDest - defDest,
      threeRate: wars > 0 ? (stars3 / wars) * 100 : 0,
      wars,
      missDef,
      stars3,
      stars2,
      stars1,
      stars0,
      avgDistance,
      atkSameOrHigherTh: p.atkSameOrHigherTh,
    };
    if (withDetails) {
      player.defCount = p.defAttacks.length;
      player.defenseLog = p.defenseLog;
    }
    return player;
  });
};

/**
 * Descarga el grupo de CWL + todas las guerras del grupo que involucran a
 * clanTag, y agrega las estadísticas por jugador con la misma forma que
 * antes producía dataParser.js a partir del texto pegado manualmente.
 *
 * Devuelve null si el clan no está actualmente en una CWL (grupo no
 * encontrado / 404).
 */
export const syncCwlData = async (clanTag, clanLabel) => {
  // La API devuelve los tags SIEMPRE en mayusculas y con "#". Hay que
  // comparar contra la version normalizada o ninguna guerra coincidiria.
  const tag = normalizeTag(clanTag);

  const [clanInfo, group] = await Promise.all([
    getClanInfo(tag),
    getCurrentWarLeagueGroup(tag),
  ]);

  if (!group || !group.rounds) {
    return null;
  }

  const warTags = group.rounds
    .flatMap((round) => round.warTags)
    .filter((tag) => tag && tag !== "#0");

  const wars = (
    await Promise.all(warTags.map((tag) => getClanWarLeagueWar(tag)))
  ).filter(Boolean);

  // Nos quedamos solo con las guerras donde participa nuestro clan (el
  // array de warTags de una ronda incluye TODOS los emparejamientos del
  // grupo de 8 clanes ese día, no solo el nuestro).
  const ourWars = wars
    .map((war) => {
      const isHome = war.clan?.tag === tag;
      const isAway = war.opponent?.tag === tag;
      if (!isHome && !isAway) return null;
      return {
        raw: war,
        us: isHome ? war.clan : war.opponent,
        them: isHome ? war.opponent : war.clan,
      };
    })
    .filter(Boolean);

  const completedWars = ourWars.filter((w) => isCompletedWar(w.raw));
  const liveWars = ourWars.filter((w) => isLiveWar(w.raw));
  // Solo cuentan como ganadas las guerras ya terminadas: una en curso
  // puede darse la vuelta en el ultimo minuto.
  const warsWon = completedWars.filter((w) => didWeWin(w.us, w.them)).length;
  const warSize = ourWars[0]?.raw?.teamSize || 15;

  // Agregacion por jugador (solo guerras terminadas) y orden por defecto.
  const players = aggregatePlayers(completedWars, clanLabel).sort(
    compareDefaultOrder
  );

  // Posición final dentro del grupo (provisional si aún quedan guerras).
  const position = calculateGroupPosition(group, wars, tag);

  return {
    players,
    league: clanInfo?.warLeague?.name || clanInfo?.clanWarLeague?.name || null,
    clanName: clanInfo?.name || null,
    warsWon,
    warSize,
    position,
    groupState: group.state,
    // Progreso para poder mostrar "Round 3 of 7" y avisar de que la
    // posicion/bonos aun pueden cambiar.
    season: group.season || null,
    roundsTotal: group.rounds ? group.rounds.length : null,
    roundsCompleted: completedWars.length,
    liveRounds: liveWars.length,
    isComplete: liveWars.length === 0 && completedWars.length > 0,
  };
};

/**
 * Clasifica los 8 clanes del grupo por (guerras ganadas, estrellas totales,
 * destrucción total) y devuelve la posición (1-8) de clanTag.
 *
 * ATENCIÓN: sin verificar contra la API real no puedo garantizar al 100%
 * que el criterio de desempate de Supercell sea exactamente este orden
 * (guerras > estrellas > destrucción). Es el orden documentado más
 * habitual, pero conviene confirmarlo con una temporada real.
 */
const calculateGroupPosition = (group, wars, clanTag) => {
  if (!group.clans) return null;

  const totals = new Map(
    group.clans.map((c) => [c.tag, { tag: c.tag, wins: 0, stars: 0, destruction: 0 }])
  );

  wars.filter(isCompletedWar).forEach((war) => {
    [war.clan, war.opponent].forEach((side) => {
      const t = totals.get(side.tag);
      if (!t) return;
      t.stars += side.stars;
      t.destruction += side.destructionPercentage;
    });
    const winner = didWeWin(war.clan, war.opponent) ? war.clan : war.opponent;
    const t = totals.get(winner.tag);
    if (t) t.wins += 1;
  });

  const ranked = Array.from(totals.values()).sort(
    (a, b) => b.wins - a.wins || b.stars - a.stars || b.destruction - a.destruction
  );

  const index = ranked.findIndex((c) => c.tag === clanTag);
  return index === -1 ? null : index + 1;
};

const emptyPlayerStats = (member, clanLabel) => ({
  name: member.name,
  tag: member.tag,
  clan: clanLabel,
  th: member.townhallLevel || 0,
  missAtk: 0,
  offStars: 0,
  offDest: 0,
  defStars: 0,
  defDest: 0,
  netStars: 0,
  netDest: 0,
  threeRate: 0,
  wars: 0,
  missDef: 0,
  stars3: 0,
  stars2: 0,
  stars1: 0,
  stars0: 0,
  avgDistance: 0,
  atkSameOrHigherTh: 0,
  defCount: 0,
  defenseLog: [],
});

/**
 * Vista de un lado (nuestro clan o el rival) para la pantalla en vivo:
 * estadisticas acumuladas de las rondas TERMINADAS + estado en la ronda
 * actual. Funciona igual para cualquier clan del grupo porque la API da
 * todas las guerras del grupo, no solo las nuestras.
 */
const buildSideView = (side, other, completedPairs) => {
  const label = side.name;
  const byTag = new Map(
    aggregatePlayers(completedPairs, label, { withDetails: true }).map((p) => [p.tag, p])
  );
  const lineup = new Map((side.members || []).map((m) => [m.tag, m]));

  // Jugadores de la alineacion actual que aun no tienen ninguna guerra
  // terminada (p. ej. en la ronda 1) tambien aparecen, con todo a cero.
  lineup.forEach((m, tag) => {
    if (!byTag.has(tag)) byTag.set(tag, emptyPlayerStats(m, label));
  });

  return Array.from(byTag.values())
    .map((p) => {
      const m = lineup.get(p.tag);
      let thisRound = null;
      if (m) {
        const attack = (m.attacks || [])[0] || null;
        const target = attack
          ? (other.members || []).find((x) => x.tag === attack.defenderTag)
          : null;
        thisRound = {
          position: m.mapPosition,
          attack: attack
            ? {
                stars: attack.stars,
                destruction: attack.destructionPercentage,
                targetPosition: target ? target.mapPosition : null,
              }
            : null,
        };
      }
      return { ...p, th: m?.townhallLevel || p.th, thisRound };
    })
    .sort(compareDefaultOrder);
};

/**
 * Ronda de CWL activa ahora mismo (en preparacion o en guerra), pensada
 * SOLO para visualizacion en vivo. No alimenta las estadisticas de la
 * temporada: esas solo se actualizan cuando la guerra termina.
 *
 * Devuelve null si el clan no esta en CWL o si no hay ninguna ronda
 * abierta en este momento (p. ej. entre rondas).
 */
export const getCurrentCwlWar = async (clanTag) => {
  const tag = normalizeTag(clanTag);
  const group = await getCurrentWarLeagueGroup(tag);
  if (!group || !group.rounds) return null;

  const warTags = group.rounds
    .flatMap((round) => round.warTags)
    .filter((tag) => tag && tag !== "#0");

  const wars = (
    await Promise.all(warTags.map((tag) => getClanWarLeagueWar(tag)))
  ).filter(Boolean);

  const ours = wars
    .map((war) => {
      const isHome = war.clan?.tag === tag;
      const isAway = war.opponent?.tag === tag;
      if (!isHome && !isAway) return null;
      return {
        raw: war,
        us: isHome ? war.clan : war.opponent,
        them: isHome ? war.opponent : war.clan,
      };
    })
    .filter(Boolean);

  // La ronda "actual" es la que esta en guerra; si no hay ninguna, la que
  // este en preparacion.
  const active =
    ours.find((w) => w.raw.state === "inWar") ||
    ours.find((w) => w.raw.state === "preparation");
  if (!active) return null;

  const { raw, us, them } = active;

  // Ataques de cada miembro nuestro, con el objetivo resuelto para poder
  // mostrar "#3 -> #5" en vez de un tag suelto.
  const roster = (us.members || [])
    .slice()
    .sort((a, b) => a.mapPosition - b.mapPosition)
    .map((member) => {
      const attacks = (member.attacks || []).map((a) => {
        const defender = them.members.find((m) => m.tag === a.defenderTag);
        return {
          stars: a.stars,
          destruction: a.destructionPercentage,
          defenderPosition: defender ? defender.mapPosition : null,
          defenderName: defender ? defender.name : null,
        };
      });
      const defenses = them.members
        .flatMap((m) => m.attacks || [])
        .filter((a) => a.defenderTag === member.tag);
      const bestDefense = defenses.reduce(
        (worst, a) =>
          !worst ||
          a.stars > worst.stars ||
          (a.stars === worst.stars && a.destructionPercentage > worst.destruction)
            ? { stars: a.stars, destruction: a.destructionPercentage }
            : worst,
        null
      );
      return {
        tag: member.tag,
        name: member.name,
        th: member.townhallLevel || 0,
        position: member.mapPosition,
        attacks,
        hasAttacked: attacks.length > 0,
        defense: bestDefense,
      };
    });

  // Metricas de contexto para el panel de guerra.
  const attacksPerMember = raw.attacksPerMember || 1; // CWL = 1 ataque
  const totalAttacks = raw.teamSize * attacksPerMember;
  const usAttacksUsed = (us.members || []).reduce((n, m) => n + (m.attacks || []).length, 0);
  const themAttacksUsed = (them.members || []).reduce((n, m) => n + (m.attacks || []).length, 0);
  // Cuantas de NUESTRAS aldeas han sido atacadas y cuantas aguantaron a 0.
  const ourBasesAttacked = roster.filter((p) => p.defense).length;
  const perfectDefenses = roster.filter((p) => p.defense && p.defense.stars === 0).length;

  // Guerras TERMINADAS de un clan cualquiera del grupo (para sus stats).
  const completedPairsOf = (clanTagX) =>
    wars
      .filter(isCompletedWar)
      .map((w) => {
        if (w.clan?.tag === clanTagX) return { us: w.clan, them: w.opponent };
        if (w.opponent?.tag === clanTagX) return { us: w.opponent, them: w.clan };
        return null;
      })
      .filter(Boolean);
  const usCompleted = completedPairsOf(us.tag);

  return {
    state: raw.state, // "preparation" | "inWar"
    roundsCompleted: usCompleted.length,
    // Stats acumuladas por jugador (solo rondas terminadas) + estado en
    // la ronda actual, para nuestro clan y para el rival.
    usPlayers: buildSideView(us, them, usCompleted),
    themPlayers: buildSideView(them, us, completedPairsOf(them.tag)),
    teamSize: raw.teamSize,
    attacksPerMember,
    usAttacksUsed,
    usAttacksLeft: totalAttacks - usAttacksUsed,
    themAttacksUsed,
    themAttacksLeft: totalAttacks - themAttacksUsed,
    ourBasesAttacked,
    ourBasesUntouched: raw.teamSize - ourBasesAttacked,
    perfectDefenses,
    starsLeft: raw.teamSize * 3 - (us.stars || 0),
    startTime: raw.startTime,
    endTime: raw.endTime,
    us: {
      name: us.name,
      tag: us.tag,
      stars: us.stars || 0,
      destruction: us.destructionPercentage || 0,
      attacksUsed: (us.members || []).reduce((n, m) => n + (m.attacks || []).length, 0),
    },
    them: {
      name: them.name,
      tag: them.tag,
      stars: them.stars || 0,
      destruction: them.destructionPercentage || 0,
      attacksUsed: (them.members || []).reduce((n, m) => n + (m.attacks || []).length, 0),
    },
    roster,
  };
};
