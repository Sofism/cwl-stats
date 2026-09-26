/**
 * Agrega, jugador a jugador, las guerras normales guardadas de un clan
 * (solo datos live del cron; el pegado manual ya no se usa).
 *
 * Metricas (acordadas con Santi, sin filtros ajustables):
 * - 3★ rate: de los ataques FRESH (primer golpe a esa base, "clean shot")
 *   contra un rival del MISMO TH exacto, que % fueron triple.
 * - Defense rate: una "defensa" es cualquier ataque que NO fue triple (0, 1
 *   o 2★), de un atacante del MISMO TH, recibido ANTES de que la base
 *   cayera en triple - la base aguanto varios golpes hasta ser derrotada.
 *   Los ataques posteriores al triple no cuentan. Rate = defensas / (defensas
 *   + el triple de mismo TH que la tumbo, si lo hubo). Incluye ataques de
 *   repaso (no solo fresh), porque justo esos son los golpes repetidos.
 * - Missed wars: guerras en las que no uso NINGUNO de sus ataques.
 */
export const aggregateNormalWarStats = (wars) => {
  const byKey = new Map();

  // Clave: tag si existe; si no (pegado manual sin columna Tag), el nombre.
  const getPlayer = (rawTag, name, th) => {
    const key = rawTag || name;
    if (!byKey.has(key)) {
      byKey.set(key, {
        tag: rawTag,
        name,
        th: th || 0,
        wars: 0,
        detailedWars: 0,
        missedWars: 0,
        sameThAttacks: 0,
        sameThTriples: 0,
        sameThDefenses: 0,
        sameThHeld: 0,
        defensesFaced: 0,
        defensesHeld: 0,
        defensesTripled: 0,
      });
    }
    const p = byKey.get(key);
    p.name = name;
    p.th = Math.max(p.th || 0, th || 0);
    return p;
  };

  wars.forEach((war) => {
    (war.us?.players || []).forEach((pl) => {
      const p = getPlayer(pl.tag, pl.name, pl.th);
      p.wars += 1;
      p.detailedWars += 1;
      const attacksPerMember = war.attacksPerMember || pl.attacksPerMember || 1;
      const attacks = pl.attacks || [];
      if (attacks.length === 0 && attacksPerMember > 0) p.missedWars += 1;

      attacks.forEach((a) => {
        if (a.fresh && a.opponentTh === pl.th) {
          p.sameThAttacks += 1;
          if (a.stars === 3) p.sameThTriples += 1;
        }
      });

      // Defensas en orden de ataque; se corta en el primer triple (de
      // cualquier atacante: la base ya cayo). Registros antiguos sin `order`
      // conservan el orden guardado.
      const faced = (pl.defenses || [])
        .slice()
        .sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
      // Contadores para el filtro de defensa (cualquier TH, todos los golpes).
      faced.forEach((d) => {
        p.defensesFaced += 1;
        if (d.stars === 3) p.defensesTripled += 1;
        else p.defensesHeld += 1;
      });
      for (const d of faced) {
        const sameTh = d.attackerTh === pl.th;
        if (d.stars === 3) {
          if (sameTh) p.sameThDefenses += 1;
          break;
        }
        if (sameTh) {
          p.sameThDefenses += 1;
          p.sameThHeld += 1;
        }
      }
    });
  });

  return Array.from(byKey.values()).map((p) => ({
    ...p,
    threeRate: p.sameThAttacks > 0 ? (p.sameThTriples / p.sameThAttacks) * 100 : null,
    defenseRate: p.sameThDefenses > 0 ? (p.sameThHeld / p.sameThDefenses) * 100 : null,
  }));
};
