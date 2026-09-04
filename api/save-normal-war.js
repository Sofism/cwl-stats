const { normalizeTag } = require("./_lib/cocProxy");
const { replaceManual } = require("./_lib/normalWarStore");

/**
 * Guarda a mano el agregado de las ultimas guerras normales de un clan, en
 * un solo pegado (igual que la temporada entera de CWL se pega de una
 * vez). El cliente ya parsea el texto con parseData (src/utils/dataParser.js)
 * - EL MISMO parser que las 11 temporadas historicas de CWL, mismas
 * columnas - y manda aqui el array de jugadores ya listo, cada uno con su
 * propio numero de guerras (columna "wars" del pegado).
 *
 * Solo tiene el lado propio: igual que el pegado manual de CWL nunca tuvo
 * datos del rival, esto son estadisticas agregadas por jugador, no un log
 * ataque a ataque (eso solo lo da el cron automatico, que sondea la guerra
 * mientras esta viva).
 *
 * IMPORTANTE: esto SUSTITUYE cualquier pegado manual anterior de este
 * clan (ver replaceManual) en vez de acumularse. Un "ultimas 10 guerras"
 * pegado hoy y otra vez el mes que viene solapa guerras ya contadas; sumar
 * los dos las contaria dos veces. Los registros que sí capturo el cron
 * (source: "cron") no se tocan.
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
    const { clanTag, asOfDate, players } = req.body || {};
    if (!clanTag || !asOfDate || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "Missing clanTag, asOfDate or players" });
    }

    const tag = normalizeTag(clanTag);

    const record = {
      warKey: "manual-aggregate",
      source: "manual",
      asOfDate,
      us: { players },
      them: null,
      syncedAt: Date.now(),
    };

    await replaceManual(tag, record);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Save normal war error:", err);
    return res.status(500).json({ error: "Failed", details: err.message });
  }
}
