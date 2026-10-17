const redis = require('./redis');
const { normalizeTag } = require('./_lib/cocProxy');

/**
 * Quien estaba "opt out" cuando EMPEZO la guerra actual, tal como lo congelo
 * el cron la primera vez que la vio (api/sync.js). Solo lee Redis: no hace
 * ninguna peticion a Clash. Si el cron aun no ha visto la guerra, devuelve
 * players: null (la app muestra que esta pendiente en vez de calcularlo por
 * su cuenta: una foto tomada a mitad de guerra daria un dato falso).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clanTag = req.query && req.query.clanTag;
  if (!clanTag) return res.status(400).json({ error: 'Missing clanTag' });

  try {
    const tag = normalizeTag(clanTag);
    const raw = await redis.get(`normal-wars-progress:${tag}`);
    const progress = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    if (!progress || !progress.lastWar || !Array.isArray(progress.optOutTags)) {
      return res.status(200).json({ warKey: progress ? progress.warKey : null, players: null });
    }
    // Los opt-out no estan en la alineacion de la guerra: sus nombres se
    // guardaron al capturarlos. Progresos anteriores a eso solo tienen tags.
    const players = progress.optOutPlayers || progress.optOutTags.map((t) => ({ tag: t, name: t }));
    return res.status(200).json({
      warKey: progress.warKey,
      capturedAt: progress.optOutCapturedAt || null,
      total: progress.optOutTotal || null,
      players,
    });
  } catch (err) {
    console.error('War optouts error:', err);
    return res.status(500).json({ error: 'Failed', details: err.message });
  }
}
