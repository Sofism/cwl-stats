/**
 * Utilidades del log de ataques de guerras normales.
 *
 * El campo `order` de la API es el numero global del ataque dentro de la
 * guerra (1, 2, 3... entre los DOS clanes). En los registros guardados los
 * ataques propios (`attacks`) no lo traian al principio, pero cada ataque
 * aparece tambien como DEFENSA del otro lado (con `order` y `attackerTag`),
 * asi que la cronologia completa se reconstruye a partir de las defensas de
 * los dos bandos. Las guerras guardadas antes de guardar `order` en las
 * defensas no permiten ordenar: `hasOrder` sale false y se avisa.
 */

/**
 * @returns {{events: Array, hasOrder: boolean}} events en orden cronologico
 * (si se conoce), cada uno:
 *  { order, side: "us"|"them", attacker, defender, stars, destruction,
 *    fresh, attackerTh }
 * donde attacker/defender son los jugadores ({tag, name, th}) de su bando.
 */
export const buildTimeline = (war) => {
  const usPlayers = war?.us?.players || [];
  const themPlayers = war?.them?.players || [];
  const usByTag = new Map(usPlayers.map((p) => [p.tag, p]));
  const themByTag = new Map(themPlayers.map((p) => [p.tag, p]));
  const events = [];

  // Ataques del RIVAL a nuestras bases = defensas de nuestros jugadores.
  usPlayers.forEach((defender) =>
    (defender.defenses || []).forEach((d) =>
      events.push({
        order: d.order,
        side: "them",
        attacker: themByTag.get(d.attackerTag) || { tag: d.attackerTag, name: "Unknown", th: d.attackerTh },
        defender,
        stars: d.stars,
        destruction: d.destruction,
        fresh: d.fresh,
        attackerTh: d.attackerTh,
        seenAt: d.seenAt,
      })
    )
  );
  // Ataques NUESTROS = defensas de los jugadores del rival.
  themPlayers.forEach((defender) =>
    (defender.defenses || []).forEach((d) =>
      events.push({
        order: d.order,
        side: "us",
        attacker: usByTag.get(d.attackerTag) || { tag: d.attackerTag, name: "Unknown", th: d.attackerTh },
        defender,
        stars: d.stars,
        destruction: d.destruction,
        fresh: d.fresh,
        attackerTh: d.attackerTh,
        seenAt: d.seenAt,
      })
    )
  );

  const hasOrder = events.length > 0 && events.every((e) => typeof e.order === "number");
  if (hasOrder) events.sort((a, b) => a.order - b.order);
  return { events, hasOrder, hasTiming: events.some((e) => typeof e.seenAt === "number") };
};

/**
 * Orden de cada ataque propio de un jugador ({tag, order}) a partir de la
 * cronologia: clave attackerTag|defenderTag|stars|destruction.
 */
export const attackOrderIndex = (timeline) => {
  const map = new Map();
  timeline.events
    .filter((e) => e.side === "us")
    .forEach((e) => map.set(`${e.attacker.tag}|${e.defender.tag}|${e.stars}|${e.destruction}`, e.order));
  return map;
};

/**
 * Historial de un jugador en las guerras dadas (de mas reciente a mas
 * antigua, tal como vengan): sus ataques y defensas en cada una.
 */
export const playerHistory = (wars, key) =>
  wars
    .map((war) => {
      const p = (war.us?.players || []).find((pl) => (pl.tag || pl.name) === key);
      if (!p) return null;
      const timeline = buildTimeline(war);
      const idx = attackOrderIndex(timeline);
      const attacks = (p.attacks || []).map((a) => ({
        ...a,
        order: a.order ?? idx.get(`${p.tag}|${a.opponentTag}|${a.stars}|${a.destruction}`),
      }));
      attacks.sort((x, y) => (x.order ?? 1e9) - (y.order ?? 1e9));
      const defenses = (p.defenses || []).slice().sort((x, y) => (x.order ?? 1e9) - (y.order ?? 1e9));
      return { war, player: p, attacks, defenses, missed: attacks.length === 0 };
    })
    .filter(Boolean);

/**
 * Orden por defecto de las tablas de Clan stats: por la columna elegida y,
 * a igualdad, por las demas metricas de ataque y defensa. NUNCA por nombre
 * (decision de Santi): un empate total conserva el orden de entrada. Quien no
 * tiene muestra en la columna elegida va siempre al final.
 */
export const compareClanStats = (sort) => (a, b) => {
  const num = (x, y, dir) => {
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return dir === "asc" ? x - y : y - x;
  };
  const chain = [
    [sort.key, sort.dir],
    ["threeRate", "desc"],
    ["defenseRate", "desc"],
    ["sameThAttacks", "desc"],
    ["sameThDefenses", "desc"],
    ["wars", "desc"],
    ["missedWars", "asc"],
  ];
  for (const [key, dir] of chain) {
    const r = num(a[key], b[key], dir);
    if (r !== 0) return r;
  }
  return 0;
};

const parseApiDate = (raw) => {
  if (!raw) return null;
  const d = new Date(raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6"));
  return isNaN(d.getTime()) ? null : d;
};

const fmtDuration = (ms) => {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * Cuando se hizo un ataque respecto al RELOJ DE GUERRA. La API no da la hora
 * de cada ataque: `seenAt` es cuando nuestro cron lo vio por primera vez, asi
 * que el ataque ocurrio en algun punto de la hora anterior (de ahi el "~").
 * Se devuelve el tiempo que quedaba (como la cuenta atras del juego) y el
 * transcurrido desde que empezo la batalla. null si no hay dato.
 */
export const warClock = (seenAt, war) => {
  if (typeof seenAt !== "number") return null;
  const start = parseApiDate(war?.startTime);
  const end = parseApiDate(war?.endTime);
  if (!start || !end) return null;
  const elapsed = Math.max(0, seenAt - start.getTime());
  const remaining = Math.max(0, end.getTime() - seenAt);
  return {
    left: `~${fmtDuration(remaining)} left`,
    title: `Seen by our check ${fmtDuration(elapsed)} into the battle (${fmtDuration(remaining)} on the war clock). The API gives no attack times: it happened within the hour before that check.`,
  };
};
