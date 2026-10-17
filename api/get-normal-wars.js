const redis = require("./redis");
const { normalizeTag, getCurrentWar, getClanMembers, getWarLog } = require("./_lib/cocProxy");
const { touchRoster, activeTagsFromSeen } = require("./_lib/normalWarStore");
const { buildNormalWarRecord } = require("./_lib/normalWarStats");

/**
 * Guerras normales ya finalizadas de un clan, guardadas por api/sync.js.
 * De solo lectura: la escritura pasa siempre por el cron.
 *
 * Ademas devuelve `live`: la guerra en curso (state inWar/warEnded) armada
 * con el mismo builder que usa el cron, para poder ver el log de ataques
 * antes de que la guerra se guarde. NO se persiste ni cuenta para las
 * estadisticas (solo cuentan las terminadas). Si la API de Clash falla, se
 * usa la ultima foto que guardo el cron.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clanTag = req.query?.clanTag;
  if (!clanTag) {
    return res.status(400).json({ error: "Missing clanTag" });
  }

  try {
    const tag = normalizeTag(clanTag);
    const data = await redis.get(`normal-wars:${tag}`);
    const wars = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];

    // Quien sigue "en el clan": miembros actuales + los vistos hace menos
    // de 12 h. null = sin datos (o fallo), la UI entonces no oculta a nadie.
    let activeTags = null;
    try {
      const members = await getClanMembers(tag);
      activeTags = activeTagsFromSeen(await touchRoster(tag, members));
    } catch (e) {
      console.error("Roster error:", e);
    }

    let lastSync = null;
    try {
      const raw = await redis.get(`sync-status:${tag}`);
      lastSync = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
    } catch (e) {
      console.error("Sync status error:", e);
    }

    // Historial oficial: permite listar las guerras de las que no hay datos
    // por jugador (no capturadas o a medias) con su resultado. Solo
    // guerras normales: las lineas de CWL del historial (1 ataque por
    // miembro, estrellas por encima del maximo de una guerra) se descartan.
    let warlog = null;
    try {
      const items = await getWarLog(tag);
      if (items) {
        warlog = items
          .filter((it) => it.attacksPerMember !== 1 && (it.clan?.stars || 0) <= (it.teamSize || 0) * 3)
          .slice(0, 60)
          .map((it) => ({
            endTime: it.endTime,
            result: it.result,
            teamSize: it.teamSize,
            attacksPerMember: it.attacksPerMember || 2,
            us: {
              stars: it.clan?.stars || 0,
              destruction: it.clan?.destructionPercentage || 0,
              attacks: it.clan?.attacks ?? null,
              expEarned: it.clan?.expEarned ?? null,
            },
            them: {
              tag: it.opponent?.tag,
              name: it.opponent?.name,
              stars: it.opponent?.stars || 0,
              destruction: it.opponent?.destructionPercentage || 0,
            },
          }));
      }
    } catch (e) {
      console.error("War log error:", e);
    }

    let live = null;
    try {
      const progress = await redis.get(`normal-wars-progress:${tag}`);
      const prog = progress ? (typeof progress === "string" ? JSON.parse(progress) : progress) : null;
      let war = null;
      try {
        war = await getCurrentWar(tag);
      } catch (e) {
        war = prog?.lastWar || null;
      }
      if (war && (war.state === "inWar" || war.state === "warEnded")) {
        live = buildNormalWarRecord(war, tag, prog?.optOutTags || []);
        if (live) {
          live.state = war.state;
          // Sin foto de opt-outs del cron no se sabe: mejor sin marcador
          // que un verde falso para todos.
          if (!prog?.optOutTags) live.us.players.forEach((pl) => (pl.optedOut = null));
        }
      }
    } catch (e) {
      console.error("Live war error:", e);
    }

    return res.status(200).json({ wars, live, activeTags, lastSync, warlog });
  } catch (err) {
    console.error("Get normal wars error:", err);
    return res.status(500).json({ error: "Failed", details: err.message });
  }
}
