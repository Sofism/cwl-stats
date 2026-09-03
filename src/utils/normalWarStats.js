/**
 * Agrega, jugador a jugador, todas las guerras normales guardadas de un
 * clan — tanto las capturadas por el cron (log completo ataque a ataque)
 * como las pegadas a mano (solo agregado por guerra, sin TH del rival ni
 * distincion fresh/repaso).
 *
 * Reglas acordadas:
 * - Success rate (ofensa) y defense failure rate (defensa) solo cuentan
 *   ataques FRESH (el primer golpe a esa base, no los de repaso).
 * - Por defecto, ofensa solo cuenta contra TH igual o SUPERIOR (pegar a un
 *   TH mas bajo no dice nada de tu nivel); defensa solo cuenta cuando te
 *   ataca alguien de TH igual o INFERIOR (perder contra un TH mas alto es
 *   esperable). Ambos filtros son ajustables via el selector de la UI.
 * - Las guerras pegadas a mano no tienen este detalle: se suman tal cual
 *   vienen (ya traen star3/star2/star1/star0 agregados desde
 *   dataParser.js) y no pueden respetar el filtro de TH/fresh.
 */
export const aggregateNormalWarStats = (
  wars,
  { attackThFilter = "upOrEqual", defenseThFilter = "downOrEqual" } = {}
) => {
  const byTag = new Map();

  const getPlayer = (tag, name, th) => {
    if (!byTag.has(tag)) {
      byTag.set(tag, {
        tag,
        name,
        th: th || 0,
        wars: 0,
        missAtk: 0,
        missedBoth: 0,
        missedOne: 0,
        offAttacksCounted: 0,
        offStars3: 0,
        offStars2: 0,
        offStars1: 0,
        offStars0: 0,
        defAttacksCounted: 0,
        defStars3: 0,
        defStars2: 0,
        defStars1: 0,
        defStars0: 0,
        rawOffStars: 0,
        rawDefStars: 0,
        rawOffDest: 0,
        rawDefDest: 0,
      });
    }
    const p = byTag.get(tag);
    p.name = name;
    p.th = Math.max(p.th || 0, th || 0);
    return p;
  };

  // Ofensa: por defecto solo cuenta si el rival es de TH igual o superior.
  const passesAttackFilter = (ourTh, oppTh) => {
    if (attackThFilter === "all" || oppTh == null) return true;
    return oppTh >= ourTh;
  };
  // Defensa: por defecto solo cuenta si quien nos ataca es de TH igual o
  // inferior (direccion invertida respecto a ofensa, a proposito).
  const passesDefenseFilter = (ourTh, attackerTh) => {
    if (defenseThFilter === "all" || attackerTh == null) return true;
    return attackerTh <= ourTh;
  };

  wars.forEach((war) => {
    const players = war.us?.players || [];
    players.forEach((pl) => {
      const p = getPlayer(pl.tag, pl.name, pl.th);
      p.wars += 1;

      if (war.source === "manual") {
        p.missAtk += pl.missAtk || 0;
        p.rawOffStars += pl.offStars || 0;
        p.rawDefStars += pl.defStars || 0;
        p.rawOffDest += pl.offDest || 0;
        p.rawDefDest += pl.defDest || 0;
        p.offStars3 += pl.stars3 || 0;
        p.offStars2 += pl.stars2 || 0;
        p.offStars1 += pl.stars1 || 0;
        p.offStars0 += pl.stars0 || 0;
        p.offAttacksCounted +=
          (pl.stars3 || 0) + (pl.stars2 || 0) + (pl.stars1 || 0) + (pl.stars0 || 0);
        return;
      }

      const attacksPerMember = war.attacksPerMember || pl.attacksPerMember || 1;
      const attacks = pl.attacks || [];
      const missed = attacksPerMember - attacks.length;
      p.missAtk += Math.max(0, missed);
      if (missed >= attacksPerMember && attacksPerMember > 0) p.missedBoth += 1;
      else if (missed > 0) p.missedOne += 1;

      attacks.forEach((a) => {
        p.rawOffStars += a.stars;
        p.rawOffDest += a.destruction;
        if (a.fresh && passesAttackFilter(pl.th, a.opponentTh)) {
          p.offAttacksCounted += 1;
          if (a.stars === 3) p.offStars3 += 1;
          else if (a.stars === 2) p.offStars2 += 1;
          else if (a.stars === 1) p.offStars1 += 1;
          else p.offStars0 += 1;
        }
      });

      (pl.defenses || []).forEach((d) => {
        p.rawDefStars += d.stars;
        p.rawDefDest += d.destruction;
        if (d.fresh && passesDefenseFilter(pl.th, d.attackerTh)) {
          p.defAttacksCounted += 1;
          if (d.stars === 3) p.defStars3 += 1;
          else if (d.stars === 2) p.defStars2 += 1;
          else if (d.stars === 1) p.defStars1 += 1;
          else p.defStars0 += 1;
        }
      });
    });
  });

  return Array.from(byTag.values())
    .map((p) => ({
      ...p,
      netStars: p.rawOffStars - p.rawDefStars,
      netDest: p.rawOffDest - p.rawDefDest,
      successRate: p.offAttacksCounted > 0 ? (p.offStars3 / p.offAttacksCounted) * 100 : 0,
      defenseFailRate: p.defAttacksCounted > 0 ? (p.defStars3 / p.defAttacksCounted) * 100 : 0,
    }))
    .sort((a, b) => {
      if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
      return b.netStars - a.netStars;
    });
};
