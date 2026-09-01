// Construye el registro final de una guerra normal terminada. Solo se debe
// llamar con guerras en estado "warEnded": la sincronizacion es "guerra a
// guerra", igual que en cwlSync.js.
//
// A diferencia de CWL (siempre 1 ataque por miembro), una guerra normal
// puede tener 1 o 2 ataques por miembro (war.attacksPerMember), asi que no
// se asume member.attacks[0].
const { normalizeTag } = require("./cocProxy");

// El campo `order` es el orden global del ataque dentro de la guerra. El
// `order` mas bajo para un defenderTag dado es el primer golpe que recibio
// esa base ("fresh"); el resto son de repaso ("cleanup"). Se usa igual
// para nuestras ofensivas que para las que recibimos.
const firstHitOrders = (attacks) => {
  const map = new Map();
  attacks.forEach((a) => {
    const current = map.get(a.defenderTag);
    if (current === undefined || a.order < current) map.set(a.defenderTag, a.order);
  });
  return map;
};

const didWeWin = (us, them) => {
  if (us.stars !== them.stars) return us.stars > them.stars;
  if (us.destructionPercentage !== them.destructionPercentage) {
    return us.destructionPercentage > them.destructionPercentage;
  }
  return null; // empate exacto en estrellas y destruccion
};

/**
 * Ataques + defensas de UN bando, jugador a jugador. Se llama dos veces
 * (una por bando) con los argumentos cruzados: lo que para "us" son sus
 * ataques (attacksMade) para "them" son las defensas que recibio, y
 * viceversa. optOutSet solo tiene sentido para nuestro propio clan (no
 * tenemos forma de saber el warPreference del rival), asi que para el
 * bando contrario se pasa un Set vacio.
 */
const buildRoster = (members, opposingMembers, attacksMade, freshMade, attacksFaced, freshFaced, optOutSet) =>
  (members || []).map((member) => {
    const attacks = (member.attacks || []).map((a) => {
      const opponent = (opposingMembers || []).find((m) => m.tag === a.defenderTag);
      return {
        stars: a.stars,
        destruction: a.destructionPercentage,
        fresh: freshMade.get(a.defenderTag) === a.order,
        opponentTag: a.defenderTag,
        opponentTh: opponent ? opponent.townhallLevel : null,
      };
    });

    const defenses = attacksFaced
      .filter((a) => a.defenderTag === member.tag)
      .map((a) => ({
        stars: a.stars,
        destruction: a.destructionPercentage,
        fresh: freshFaced.get(a.defenderTag) === a.order,
        attackerTag: a.attackerTag,
        attackerTh: a.attackerTh,
      }));

    return {
      tag: member.tag,
      name: member.name,
      th: member.townhallLevel || 0,
      attacksUsed: attacks.length,
      attacks,
      defenses,
      optedOut: optOutSet.has(member.tag),
    };
  });

/**
 * @param {object} war - payload crudo de clans/{tag}/currentwar, state "warEnded"
 * @param {string} clanTag
 * @param {string[]} optOutTags - tags congelados al EMPEZAR esta guerra (solo aplica a nuestro clan)
 */
const buildNormalWarRecord = (war, clanTag, optOutTags = []) => {
  const tag = normalizeTag(clanTag);
  const isHome = war.clan?.tag === tag;
  const us = isHome ? war.clan : war.opponent;
  const them = isHome ? war.opponent : war.clan;
  if (!us || !them) return null;

  const optOutSet = new Set(optOutTags);

  const usAttacks = (us.members || []).flatMap((m) =>
    (m.attacks || []).map((a) => ({ ...a, attackerTag: m.tag, attackerTh: m.townhallLevel }))
  );
  const themAttacks = (them.members || []).flatMap((m) =>
    (m.attacks || []).map((a) => ({ ...a, attackerTag: m.tag, attackerTh: m.townhallLevel }))
  );

  const freshByUs = firstHitOrders(usAttacks);
  const freshByThem = firstHitOrders(themAttacks);

  // Log de ataques completo y simetrico: quien ataco a quien desde
  // CUALQUIERA de los dos bandos, no solo el nuestro.
  const usPlayers = buildRoster(us.members, them.members, usAttacks, freshByUs, themAttacks, freshByThem, optOutSet);
  const themPlayers = buildRoster(them.members, us.members, themAttacks, freshByThem, usAttacks, freshByUs, new Set());

  const win = didWeWin(us, them);
  const attacksPerMember = war.attacksPerMember || 1;

  return {
    warKey: war.preparationStartTime || war.startTime,
    startTime: war.startTime,
    endTime: war.endTime,
    teamSize: war.teamSize,
    attacksPerMember,
    result: win === null ? "tie" : win ? "win" : "loss",
    us: {
      name: us.name,
      tag: us.tag,
      stars: us.stars || 0,
      destruction: us.destructionPercentage || 0,
      players: usPlayers,
    },
    them: {
      name: them.name,
      tag: them.tag,
      stars: them.stars || 0,
      destruction: them.destructionPercentage || 0,
      players: themPlayers,
    },
    syncedAt: Date.now(),
  };
};

module.exports = { buildNormalWarRecord };
