// Calculo de estadisticas de CWL por jugador y clasificacion del grupo.
//
// Copia en servidor de la logica de src/utils/cwlSync.js (syncCwlData /
// rankGroupClans): el cliente no puede importar de api/ ni este archivo de
// src/. Mismas reglas, mismo resultado - cualquier cambio de criterio debe
// replicarse en ambos sitios.

// Penalizacion cuando a un jugador NO le ataco nadie ese dia: en vez de
// premiar "no me atacaron" se asume una defensa mala (2 estrellas / 85%).
const UNPUNISHED_DEFENSE_STARS = 2;
const UNPUNISHED_DEFENSE_DEST = 85;

const didWeWin = (ourSide, theirSide) => {
  if (ourSide.stars !== theirSide.stars) return ourSide.stars > theirSide.stars;
  return ourSide.destructionPercentage > theirSide.destructionPercentage;
};

// Ganador desde una perspectiva NEUTRAL: un empate exacto no es de nadie.
const groupWarWinner = (war) => {
  if (war.clan.stars !== war.opponent.stars) {
    return war.clan.stars > war.opponent.stars ? war.clan : war.opponent;
  }
  if (war.clan.destructionPercentage !== war.opponent.destructionPercentage) {
    return war.clan.destructionPercentage > war.opponent.destructionPercentage
      ? war.clan
      : war.opponent;
  }
  return null;
};

/** Clasificacion de los 8 clanes con las guerras TERMINADAS que se pasen. */
const rankGroupClans = (group, completedWars) => {
  if (!group.clans) return [];
  const totals = new Map(
    group.clans.map((c) => [
      c.tag,
      { tag: c.tag, name: c.name, wins: 0, losses: 0, draws: 0, played: 0, stars: 0, destruction: 0 },
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

/**
 * @param {Array<{us: object, them: object}>} ourEndedWars guerras TERMINADAS
 *   de nuestro clan, con `us`/`them` ya orientados (members con attacks).
 * @param {string} clanLabel "Main" | "Secondary"
 */
const aggregateCwlPlayers = (ourEndedWars, clanLabel) => {
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
        destTotal: 0,
        defAttacks: [],
        unpunishedDefenses: 0,
        distances: [],
      });
    }
    return byTag.get(member.tag);
  };

  ourEndedWars.forEach(({ us, them }) => {
    us.members.forEach((member) => {
      const p = getPlayer(member);
      p.roosterDays += 1;
      p.name = member.name;

      const attack = (member.attacks || [])[0];
      if (attack) {
        p.offAttacks.push(attack.stars);
        p.destTotal += attack.destructionPercentage;
        const defender = them.members.find((m) => m.tag === attack.defenderTag);
        if (defender) p.distances.push(member.mapPosition - defender.mapPosition);
      } else {
        p.missedAttacks += 1;
      }

      const defensesFaced = them.members
        .flatMap((m) => m.attacks || [])
        .filter((a) => a.defenderTag === member.tag);
      if (defensesFaced.length > 0) defensesFaced.forEach((a) => p.defAttacks.push(a));
      else p.unpunishedDefenses += 1;
    });
  });

  const players = Array.from(byTag.values()).map((p) => {
    const wars = p.roosterDays;
    const offStars = p.offAttacks.reduce((sum, s) => sum + s, 0);
    const offDest = p.destTotal;
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
      p.distances.length > 0 ? p.distances.reduce((sum, d) => sum + d, 0) / p.distances.length : 0;

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

  players.sort((a, b) => {
    if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
    if (b.netStars !== a.netStars) return b.netStars - a.netStars;
    if (clanLabel !== "Main" && a.avgDistance !== b.avgDistance) return a.avgDistance - b.avgDistance;
    if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
    return b.netDest - a.netDest;
  });

  return players;
};

module.exports = { didWeWin, rankGroupClans, aggregateCwlPlayers };
