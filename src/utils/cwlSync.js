import {
  getClanInfo,
  getClanMembers,
  getCurrentWarLeagueGroup,
  getCurrentWarLeagueGroupStrict,
  getClanWarLeagueWar,
  normalizeTag,
} from "./cocApi";
import { comparePlayers } from "./sortPlayers";
import { seasonKeyFromGroup, matchesCwlSeason, monthNameFromKey, yearFromKey } from "./cwlSeasonLink";

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
 * encontrado / 404). Lanza error si el proxy o la API de Clash fallan.
 */
export const syncCwlData = async (clanTag, clanLabel) => {
  // La API devuelve los tags SIEMPRE en mayusculas y con "#". Hay que
  // comparar contra la version normalizada o ninguna guerra coincidiria.
  const tag = normalizeTag(clanTag);

  const [clanInfo, group] = await Promise.all([
    getClanInfo(tag),
    getCurrentWarLeagueGroupStrict(tag),
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
        sameTh: 0,
        sameThTriples: 0,
        higherTh: 0,
        higherThTriples: 0,
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
          // Contra su mismo TH o uno SUPERIOR es lo que mide de verdad el
          // nivel (los "dips" a TH menores inflan el hit rate). Se guarda por
          // separado y con cuantos fueron triple: los datos de CWL
          // desaparecen de la API, y asi queda capturado por si luego se
          // quiere un 3★% de TH igual o superior.
          const defTh = defender.townhallLevel || 0;
          const ownTh = member.townhallLevel || 0;
          if (defTh === ownTh) {
            p.sameTh += 1;
            if (attack.stars === 3) p.sameThTriples += 1;
          } else if (defTh > ownTh) {
            p.higherTh += 1;
            if (attack.stars === 3) p.higherThTriples += 1;
          }
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
      sameTh: p.sameTh,
      sameThTriples: p.sameThTriples,
      higherTh: p.higherTh,
      higherThTriples: p.higherThTriples,
    };
  });

  // Orden por defecto compartido: ver sortPlayers.js.
  players.sort(comparePlayers);

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

// Puntos de CWL: 1 por estrella conseguida + 10 de bonus por cada guerra
// GANADA. El bonus del empate no esta verificado: aqui se asume que no da
// puntos (confirmar con la clasificacion del juego si llega a darse un empate
// exacto, que es rarisimo).
const WAR_WIN_POINTS = 10;

/**
 * Clasifica los 8 clanes del grupo por PUNTOS (estrellas + 10 por guerra
 * ganada) y, en caso de empate, por destruccion total, con las guerras que se
 * pasen. Para la clasificacion oficial se pasan solo las TERMINADAS; para la
 * "en vivo" tambien las que estan en curso, tratando como ganador a quien va
 * por delante ahora mismo (provisional).
 *
 * ATENCION: el orden de puntos y el desempate por destruccion es el
 * documentado habitualmente, pero no esta contrastado con la pantalla del
 * juego en una liga con empates a puntos.
 */
const rankGroupClans = (group, wars) => {
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
        points: 0,
      },
    ])
  );

  wars.forEach((war) => {
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

  totals.forEach((t) => {
    t.points = t.stars + t.wins * WAR_WIN_POINTS;
  });

  return Array.from(totals.values())
    .sort((a, b) => b.points - a.points || b.destruction - a.destruction)
    .map((c, i) => ({ ...c, rank: i + 1 }));
};

const calculateGroupPosition = (group, wars, clanTag) => {
  const ranked = rankGroupClans(group, wars.filter(isCompletedWar));
  const found = ranked.find((c) => c.tag === clanTag);
  return found ? found.rank : null;
};

/**
 * Grupo de CWL + TODAS sus guerras (hasta ~30 peticiones), con una cache de
 * 30 s por clan. Antes la vista en vivo (rondas) y el panel de clasificacion
 * (standings) descargaban las mismas guerras cada uno por su cuenta, y el
 * inicio otra vez: ~60 peticiones por apertura. Ahora se comparten.
 * `force` (botones Refresh) se salta la cache. Nunca se usa para sincronizar
 * datos de temporada (syncCwlData siempre pide lo ultimo).
 */
const CWL_CACHE_MS = 30 * 1000;
const cwlCache = new Map();

const loadCwlGroup = (tag, force = false) => {
  const hit = cwlCache.get(tag);
  if (!force && hit && Date.now() - hit.at < CWL_CACHE_MS) return hit.promise;

  const promise = (async () => {
    const group = await getCurrentWarLeagueGroup(tag);
    if (!group || !group.rounds) return null;
    const uniqueTags = [...new Set(group.rounds.flatMap((round) => round.warTags))].filter(
      (t) => t && t !== "#0"
    );
    const entries = await Promise.all(uniqueTags.map(async (t) => [t, await getClanWarLeagueWar(t)]));
    return { group, warsByTag: new Map(entries) };
  })();
  cwlCache.set(tag, { at: Date.now(), promise });
  // Un fallo no se queda en la cache: el siguiente intento vuelve a pedir.
  promise.catch(() => cwlCache.delete(tag));
  return promise;
};

/**
 * Vista de todo el grupo de CWL para el "en vivo" que se ve en el propio
 * juego: clasificación de los 8 clanes y el emparejamiento de CADA ronda
 * con TODOS los clanes (no solo el nuestro). syncCwlData/getCurrentCwlWar
 * ya descargan estos mismos datos pero solo exponen lo relativo a nuestro
 * clan; esta función hace su propia pasada porque el filtrado es distinto
 * (aquí interesan las 4 guerras de cada ronda, no solo la nuestra).
 */
export const getCwlGroupOverview = async (clanTag, { force = false } = {}) => {
  const tag = normalizeTag(clanTag);
  const loaded = await loadCwlGroup(tag, force);
  if (!loaded) return null;
  const { group, warsByTag } = loaded;

  const completedWars = [...warsByTag.values()].filter((w) => w && isCompletedWar(w));
  const standings = rankGroupClans(group, completedWars);

  // Clasificacion EN VIVO: ademas de las terminadas cuentan las guerras en
  // curso con su marcador actual (provisional: quien va por delante cuenta
  // como ganador). `change` = puestos que sube (+) o baja (-) respecto a la
  // oficial; `live` = el clan tiene una guerra en curso ahora mismo.
  const inWarWars = [...warsByTag.values()].filter((w) => w && isLiveWar(w));
  const officialRank = new Map(standings.map((c) => [c.tag, c.rank]));
  const liveTags = new Set(inWarWars.flatMap((w) => [w.clan.tag, w.opponent.tag]));
  const liveStandings = rankGroupClans(group, [...completedWars, ...inWarWars]).map((c) => ({
    ...c,
    change: (officialRank.get(c.tag) || c.rank) - c.rank,
    live: liveTags.has(c.tag),
  }));

  const rounds = group.rounds.map((round, i) => ({
    round: i + 1,
    matches: round.warTags
      .filter((t) => t && t !== "#0")
      .map((t) => {
        const war = warsByTag.get(t);
        if (!war) return null;
        // CWL es siempre 1 ataque por miembro: los restantes son el
        // tamano del equipo menos los ataques ya usados por ese lado.
        const attacksUsed = (side) =>
          (side.members || []).reduce((n, m) => n + (m.attacks || []).length, 0);

        // Por cada lado: defensas aguantadas (bases que NO han caido en 3★,
        // o sea 2★ o menos) y hit rate (ataques que fueron 3★ sobre los
        // ataques ya usados). En una guerra en curso son cifras parciales.
        const sideStats = (side, enemy) => {
          const bestAgainst = new Map();
          (enemy.members || [])
            .flatMap((m) => m.attacks || [])
            .forEach((a) => {
              const cur = bestAgainst.get(a.defenderTag);
              if (cur === undefined || a.stars > cur) bestAgainst.set(a.defenderTag, a.stars);
            });
          const tripled = [...bestAgainst.values()].filter((st) => st >= 3).length;
          const used = attacksUsed(side);
          const triples = (side.members || [])
            .flatMap((m) => m.attacks || [])
            .filter((a) => a.stars === 3).length;
          return {
            basesHeld: (side.members || []).length - tripled,
            basesTotal: (side.members || []).length,
            triples,
            attacksMade: used,
            hitRate: used > 0 ? (triples / used) * 100 : null,
          };
        };

        return {
          warTag: t,
          state: war.state,
          teamSize: war.teamSize,
          clanA: {
            tag: war.clan.tag,
            name: war.clan.name,
            badge: war.clan.badgeUrls?.small,
            stars: war.clan.stars || 0,
            destruction: war.clan.destructionPercentage || 0,
            attacksLeft: war.teamSize - attacksUsed(war.clan),
            ...sideStats(war.clan, war.opponent),
          },
          clanB: {
            tag: war.opponent.tag,
            name: war.opponent.name,
            badge: war.opponent.badgeUrls?.small,
            stars: war.opponent.stars || 0,
            destruction: war.opponent.destructionPercentage || 0,
            attacksLeft: war.teamSize - attacksUsed(war.opponent),
            ...sideStats(war.opponent, war.clan),
          },
        };
      })
      .filter(Boolean),
  }));

  return { ourTag: tag, groupState: group.state, standings, liveStandings, rounds };
};

/**
 * Construye el detalle de UNA ronda de CWL (roster con ataques/defensas,
 * metricas de contexto) para nuestro clan. Compartido entre
 * getCurrentCwlWar (solo la ronda activa) y getCwlRounds (todas, para
 * poder revisitarlas).
 */
const buildRoundDetail = (raw, us, them) => {
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
          order: a.order,
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
            ? { stars: a.stars, destruction: a.destructionPercentage, order: a.order }
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

  // Defensa aguantada = cualquier base que NO haya sido 3-estrellada (sin
  // tocar cuenta igual que aguantar con 1 o 2 estrellas). Mismo criterio
  // que homeStatus.js usa para guerra normal.
  const basesHolding = (defendingSide, attackingSide) => {
    const worstByDefender = new Map();
    (attackingSide.members || [])
      .flatMap((m) => m.attacks || [])
      .forEach((a) => {
        const current = worstByDefender.get(a.defenderTag);
        if (current === undefined || a.stars > current) worstByDefender.set(a.defenderTag, a.stars);
      });
    const threeStarred = [...worstByDefender.values()].filter((stars) => stars >= 3).length;
    return (defendingSide.members || []).length - threeStarred;
  };

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
    usBasesHolding: basesHolding(us, them),
    themBasesHolding: basesHolding(them, us),
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
 * Todas las rondas de CWL de nuestro clan que ya tienen emparejamiento
 * (preparation/inWar/warEnded), cada una con el mismo detalle de roster
 * que antes solo se calculaba para la ronda activa. Pensado para poder
 * revisitar rondas ya jugadas, no solo la de ahora mismo.
 *
 * Devuelve un array vacio si el clan no esta en CWL. Cada elemento incluye
 * `round` (1-7) ademas de todo lo que ya devuelve buildRoundDetail.
 */
export const getCwlRounds = async (clanTag, { force = false } = {}) => {
  const tag = normalizeTag(clanTag);
  const loaded = await loadCwlGroup(tag, force);
  if (!loaded) return [];
  const { group, warsByTag } = loaded;

  const roundEntries = group.rounds
    .map((round, i) => ({ round: i + 1, warTags: round.warTags.filter((t) => t && t !== "#0") }))
    .filter((r) => r.warTags.length > 0);

  const results = await Promise.all(
    roundEntries.map(async ({ round, warTags }) => {
      const wars = warTags.map((t) => warsByTag.get(t)).filter(Boolean);
      const ourWar = wars.find((war) => war.clan?.tag === tag || war.opponent?.tag === tag);
      if (!ourWar) return null;
      const isHome = ourWar.clan?.tag === tag;
      const us = isHome ? ourWar.clan : ourWar.opponent;
      const them = isHome ? ourWar.opponent : ourWar.clan;
      return { round, ...buildRoundDetail(ourWar, us, them) };
    })
  );

  return results.filter(Boolean);
};

/**
 * Ronda de CWL activa ahora mismo (en preparacion o en guerra), pensada
 * SOLO para visualizacion en vivo. No alimenta las estadisticas de la
 * temporada: esas solo se actualizan cuando la guerra termina.
 *
 * Devuelve null si el clan no esta en CWL o si no hay ninguna ronda
 * abierta en este momento (p. ej. entre rondas).
 */
export const getCurrentCwlWar = async (clanTag, opts) => {
  const rounds = await getCwlRounds(clanTag, opts);
  return (
    rounds.find((r) => r.state === "inWar") ||
    rounds.find((r) => r.state === "preparation") ||
    null
  );
};

/**
 * Descarga los dos clanes y avisa de lo que haria falta confirmar ANTES de
 * guardar nada:
 *  - `seasonMismatch`: la CWL descargada es de un mes distinto a la
 *    temporada abierta. Guardarla aqui mezclaria dos meses (asi acabaron los
 *    datos de octubre dentro de "September"), asi que no se aplica.
 *  - `*WouldReduce`: guardar quitaria jugadores que ya estaban guardados.
 *  - `mainError` / `secondaryError`: el proxy o la API de Clash fallaron
 *    para ese clan. NO es lo mismo que "no esta en CWL" (mainResult null).
 * No guarda nada por si mismo: quien la llama decide (ver applyCwlSyncResult).
 */
export const runCwlSync = async (clanNames, currentSeason) => {
  const settle = async (tag, label) => {
    try {
      return { result: await syncCwlData(tag, label), error: null };
    } catch (err) {
      return { result: null, error: err.message || "Request failed" };
    }
  };
  const [main, secondary] = await Promise.all([
    settle(clanNames.mainTag, "Main"),
    settle(clanNames.secondaryTag, "Secondary"),
  ]);
  const mainResult = main.result;
  const secondaryResult = secondary.result;

  const key = seasonKeyFromGroup({ season: (mainResult || secondaryResult)?.season });
  const seasonMismatch =
    key && !matchesCwlSeason(currentSeason, key)
      ? { key, month: monthNameFromKey(key), year: yearFromKey(key) }
      : null;

  const mainWouldReduce = Boolean(
    mainResult && mainResult.players.length < (currentSeason.mainClan?.length || 0)
  );
  const secondaryWouldReduce = Boolean(
    secondaryResult && secondaryResult.players.length < (currentSeason.secondaryClan?.length || 0)
  );

  return {
    mainResult,
    secondaryResult,
    mainError: main.error,
    secondaryError: secondary.error,
    seasonMismatch,
    mainWouldReduce,
    secondaryWouldReduce,
  };
};

/**
 * Aplica un resultado de runCwlSync (ya aceptado, directo o tras
 * confirmar) sobre una temporada. Devuelve la temporada actualizada, el
 * nuevo leagueInfo, el progreso de sincronizacion y los nombres de clan
 * que haya podido corregir la API - quien llama decide que hacer con cada
 * cosa (updateSeasonData, setLeagueInfo, updateClanNames...).
 *
 * Sincronizar a mano es una orden explicita de sobrescribir: quita la marca
 * `manual` de los clanes sincronizados (el sync automatico respeta esa
 * marca y no pisa lo pegado a mano) y vincula la temporada con su CWL.
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

  const manual = { ...(currentSeason.manual || {}) };
  if (mainResult) manual.main = false;
  if (secondaryResult) manual.secondary = false;
  const cwlComplete = { ...(currentSeason.cwlComplete || {}) };
  if (mainResult) cwlComplete.main = Boolean(mainResult.isComplete);
  if (secondaryResult) cwlComplete.secondary = Boolean(secondaryResult.isComplete);

  const ref = mainResult || secondaryResult;
  const key = ref ? seasonKeyFromGroup({ season: ref.season }) : null;

  const updatedSeason = {
    ...currentSeason,
    mainClan: mainResult ? mainResult.players : currentSeason.mainClan,
    secondaryClan: secondaryResult ? secondaryResult.players : currentSeason.secondaryClan,
    leagueInfo: newLeagueInfo,
    manual,
    cwlComplete,
    ...(key ? { cwlSeason: key } : {}),
  };

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
