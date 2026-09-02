import {
  getClanInfo,
  getClanMembers,
  getCurrentWarLeagueGroup,
  getClanWarLeagueWar,
  normalizeTag,
} from "./cocApi";

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

  // --- Agregación por jugador (clave = tag, único y estable aunque el
  // jugador cambie de nombre) ---
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
        defAttacks: [],
        unpunishedDefenses: 0,
        distances: [],
      });
    }
    return byTag.get(member.tag);
  };

  // Solo entran en las estadisticas las guerras YA TERMINADAS. Una ronda en
  // curso no suma nada hasta que cierra: mientras se juega, los ataques que
  // faltan pueden hacerse todavia y las defensas aun pueden recibirse, asi
  // que contarla daria numeros enganosos. La sincronizacion es "guerra a
  // guerra": cada ronda se incorpora en cuanto acaba.
  completedWars.forEach(({ us, them }) => {
    us.members.forEach((member) => {
      const p = getPlayer(member);
      p.roosterDays += 1;
      p.name = member.name; // se queda con el nombre más reciente

      const attack = (member.attacks || [])[0];
      if (attack) {
        p.offAttacks.push(attack.stars);
        p.offAttacks.destTotal = (p.offAttacks.destTotal || 0) + attack.destructionPercentage;
        const defender = them.members.find((m) => m.tag === attack.defenderTag);
        if (defender) {
          // (posición propia - posición del objetivo). Ej: jugador en la
          // posición 5 atacando en 20/25/30 -> (-15,-20,-25) -> media -20.
          p.distances.push(member.mapPosition - defender.mapPosition);
        }
      } else {
        p.missedAttacks += 1;
      }

      // Defensas: ataques del OTRO clan cuyo objetivo fue este miembro.
      const defensesFaced = them.members
        .flatMap((m) => m.attacks || [])
        .filter((a) => a.defenderTag === member.tag);

      if (defensesFaced.length > 0) {
        defensesFaced.forEach((a) => p.defAttacks.push(a));
      } else {
        p.unpunishedDefenses += 1;
      }
    });
  });

  const players = Array.from(byTag.values()).map((p) => {
    const wars = p.roosterDays;
    const offStars = p.offAttacks.reduce((sum, s) => sum + s, 0);
    const offDest = p.offAttacks.destTotal || 0;
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

    return {
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
    };
  });

  // Mismo criterio de orden que dataParser.js
  players.sort((a, b) => {
    if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
    if (b.netStars !== a.netStars) return b.netStars - a.netStars;
    if (clanLabel !== "Main" && a.avgDistance !== b.avgDistance) {
      return a.avgDistance - b.avgDistance;
    }
    if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
    return b.netDest - a.netDest;
  });

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
    // Ojo: NO basta con "ninguna ronda en vivo ahora mismo" (liveWars=0) -
    // eso tambien es cierto entre rondas, mientras la siguiente esta en
    // preparacion mucho antes de que la liga termine. Solo esta completa
    // si ya se jugaron todas las rondas del grupo.
    isComplete: group.rounds ? completedWars.length >= group.rounds.length : false,
  };
};

/**
 * Quien gano una guerra del grupo, desde una perspectiva NEUTRAL (no "did
 * we win" - aqui no hay "nosotros", puede ser cualquier par de los 8
 * clanes). A diferencia de didWeWin (pensado solo para contar SI GANAMOS,
 * donde un empate exacto puede tratarse como "no ganada" sin mas
 * consecuencia), aqui un empate exacto no debe adjudicarse a nadie o se
 * falsearia la clasificacion de ese clan.
 */
const groupWarWinner = (war) => {
  if (war.clan.stars !== war.opponent.stars) {
    return war.clan.stars > war.opponent.stars ? war.clan : war.opponent;
  }
  if (war.clan.destructionPercentage !== war.opponent.destructionPercentage) {
    return war.clan.destructionPercentage > war.opponent.destructionPercentage
      ? war.clan
      : war.opponent;
  }
  return null; // empate exacto: no se cuenta como ganada para nadie
};

/**
 * Clasifica los 8 clanes del grupo por (guerras ganadas, estrellas totales,
 * destrucción total) usando SOLO las guerras ya terminadas que se pasen.
 *
 * ATENCIÓN: sin verificar contra la API real no puedo garantizar al 100%
 * que el criterio de desempate de Supercell sea exactamente este orden
 * (guerras > estrellas > destrucción). Es el orden documentado más
 * habitual, pero conviene confirmarlo con una temporada real.
 */
const rankGroupClans = (group, completedWars) => {
  if (!group.clans) return [];

  const totals = new Map(
    group.clans.map((c) => [
      c.tag,
      {
        tag: c.tag,
        name: c.name,
        badge: c.badgeUrls?.small,
        wins: 0,
        losses: 0,
        draws: 0,
        played: 0,
        stars: 0,
        destruction: 0,
      },
    ])
  );

  completedWars.forEach((war) => {
    [war.clan, war.opponent].forEach((side) => {
      const t = totals.get(side.tag);
      if (!t) return;
      t.stars += side.stars || 0;
      t.destruction += side.destructionPercentage || 0;
      t.played += 1;
    });
    const winner = groupWarWinner(war);
    if (winner) {
      const loserTag = winner.tag === war.clan.tag ? war.opponent.tag : war.clan.tag;
      const winnerT = totals.get(winner.tag);
      const loserT = totals.get(loserTag);
      if (winnerT) winnerT.wins += 1;
      if (loserT) loserT.losses += 1;
    } else {
      const tA = totals.get(war.clan.tag);
      const tB = totals.get(war.opponent.tag);
      if (tA) tA.draws += 1;
      if (tB) tB.draws += 1;
    }
  });

  return Array.from(totals.values())
    .sort((a, b) => b.wins - a.wins || b.stars - a.stars || b.destruction - a.destruction)
    .map((c, i) => ({ ...c, rank: i + 1 }));
};

const calculateGroupPosition = (group, wars, clanTag) => {
  const ranked = rankGroupClans(group, wars.filter(isCompletedWar));
  const found = ranked.find((c) => c.tag === clanTag);
  return found ? found.rank : null;
};

/**
 * Vista de todo el grupo de CWL para el "en vivo" que se ve en el propio
 * juego: clasificación de los 8 clanes y el emparejamiento de CADA ronda
 * con TODOS los clanes (no solo el nuestro). syncCwlData/getCurrentCwlWar
 * ya descargan estos mismos datos pero solo exponen lo relativo a nuestro
 * clan; esta función hace su propia pasada porque el filtrado es distinto
 * (aquí interesan las 4 guerras de cada ronda, no solo la nuestra).
 */
export const getCwlGroupOverview = async (clanTag) => {
  const tag = normalizeTag(clanTag);
  const group = await getCurrentWarLeagueGroup(tag);
  if (!group || !group.rounds) return null;

  const uniqueTags = [
    ...new Set(group.rounds.flatMap((round) => round.warTags)),
  ].filter((t) => t && t !== "#0");

  const entries = await Promise.all(
    uniqueTags.map(async (t) => [t, await getClanWarLeagueWar(t)])
  );
  const warsByTag = new Map(entries);

  const completedWars = [...warsByTag.values()].filter((w) => w && isCompletedWar(w));
  const standings = rankGroupClans(group, completedWars);

  const rounds = group.rounds.map((round, i) => ({
    round: i + 1,
    matches: round.warTags
      .filter((t) => t && t !== "#0")
      .map((t) => {
        const war = warsByTag.get(t);
        if (!war) return null;
        return {
          warTag: t,
          state: war.state,
          clanA: {
            tag: war.clan.tag,
            name: war.clan.name,
            badge: war.clan.badgeUrls?.small,
            stars: war.clan.stars || 0,
            destruction: war.clan.destructionPercentage || 0,
          },
          clanB: {
            tag: war.opponent.tag,
            name: war.opponent.name,
            badge: war.opponent.badgeUrls?.small,
            stars: war.opponent.stars || 0,
            destruction: war.opponent.destructionPercentage || 0,
          },
        };
      })
      .filter(Boolean),
  }));

  return { ourTag: tag, groupState: group.state, standings, rounds };
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

  return {
    state: raw.state, // "preparation" | "inWar"
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

/**
 * Descarga los dos clanes y avisa si guardar el resultado BORRARIA datos
 * que ya habia (p. ej. una CWL nueva recien emparejada, con 0 rondas
 * jugadas, sobrescribiendo una temporada que ya tenia jugadores reales).
 * No guarda nada por si mismo: quien la llama decide si aplicar el
 * resultado directo o pedir confirmacion primero (ver applyCwlSyncResult).
 */
export const runCwlSync = async (clanNames, currentSeason) => {
  const [mainResult, secondaryResult] = await Promise.all([
    syncCwlData(clanNames.mainTag, "Main"),
    syncCwlData(clanNames.secondaryTag, "Secondary"),
  ]);

  const mainWouldReduce = Boolean(
    mainResult && mainResult.players.length < (currentSeason.mainClan?.length || 0)
  );
  const secondaryWouldReduce = Boolean(
    secondaryResult && secondaryResult.players.length < (currentSeason.secondaryClan?.length || 0)
  );

  return { mainResult, secondaryResult, mainWouldReduce, secondaryWouldReduce };
};

/**
 * Aplica un resultado de runCwlSync (ya aceptado, directo o tras
 * confirmar) sobre una temporada. Devuelve la temporada actualizada, el
 * nuevo leagueInfo, el progreso de sincronizacion y los nombres de clan
 * que haya podido corregir la API - quien llama decide que hacer con cada
 * cosa (updateSeasonData, setLeagueInfo, updateClanNames...).
 */
export const applyCwlSyncResult = (currentSeason, leagueInfo, mainResult, secondaryResult) => {
  const newLeagueInfo = {
    main: mainResult
      ? {
          league: mainResult.league || leagueInfo.main.league,
          position: mainResult.position || leagueInfo.main.position,
          warsWon: mainResult.warsWon,
          warSize: mainResult.warSize,
        }
      : leagueInfo.main,
    secondary: secondaryResult
      ? {
          league: secondaryResult.league || leagueInfo.secondary.league,
          position: secondaryResult.position || leagueInfo.secondary.position,
          warsWon: secondaryResult.warsWon,
          warSize: secondaryResult.warSize,
        }
      : leagueInfo.secondary,
  };

  const updatedSeason = {
    ...currentSeason,
    mainClan: mainResult ? mainResult.players : currentSeason.mainClan,
    secondaryClan: secondaryResult ? secondaryResult.players : currentSeason.secondaryClan,
    leagueInfo: newLeagueInfo,
  };

  const ref = mainResult || secondaryResult;
  const syncProgress = ref
    ? {
        season: ref.season,
        roundsCompleted: ref.roundsCompleted,
        roundsTotal: ref.roundsTotal,
        live: ref.liveRounds > 0,
        isComplete: ref.isComplete,
      }
    : null;

  const apiNames = {};
  if (mainResult?.clanName) apiNames.main = mainResult.clanName;
  if (secondaryResult?.clanName) apiNames.secondary = secondaryResult.clanName;

  return { updatedSeason, newLeagueInfo, syncProgress, apiNames };
};
