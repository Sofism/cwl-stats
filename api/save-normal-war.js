const { normalizeTag } = require("./_lib/cocProxy");
const { finalizeIfNew } = require("./_lib/normalWarStore");

/**
 * Guarda a mano una guerra normal que el cron no capturo (o que paso antes
 * de tener el cron activo). El cliente ya parsea el texto pegado con
 * parseData (src/utils/dataParser.js) - EL MISMO parser que se usa para
 * las 11 temporadas historicas de CWL, mismo formato de columnas - y manda
 * aqui el array de jugadores ya listo.
 *
 * Solo tiene el lado propio: igual que el pegado manual de CWL nunca tuvo
 * datos del rival, esto son estadisticas agregadas por jugador para ESA
 * guerra, no un log ataque a ataque (esa version detallada solo la puede
 * dar el cron automatico, que sondea la guerra mientras esta viva).
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { clanTag, date, opponentName, result, players } = req.body || {};
    if (!clanTag || !date || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "Missing clanTag, date or players" });
    }

    const tag = normalizeTag(clanTag);
    const warKey = `manual-${date}`;

    const record = {
      warKey,
      source: "manual",
      date,
      opponentName: opponentName || null,
      result: result || null,
      us: { players },
      them: null,
      syncedAt: Date.now(),
    };

    const saved = await finalizeIfNew(tag, record);
    if (!saved) {
      return res.status(409).json({
        error: "Ya hay una guerra guardada con esa fecha para este clan (borra o cambia la fecha).",
      });
    }

    return res.status(200).json({ ok: true, warKey });
  } catch (err) {
    console.error("Save normal war error:", err);
    return res.status(500).json({ error: "Failed", details: err.message });
  }
}
