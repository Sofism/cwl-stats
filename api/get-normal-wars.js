const redis = require("./redis");
const { normalizeTag } = require("./_lib/cocProxy");

/**
 * Guerras normales ya finalizadas de un clan, guardadas por api/sync.js.
 * De solo lectura: la escritura pasa siempre por el cron.
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
    return res.status(200).json({ wars });
  } catch (err) {
    console.error("Get normal wars error:", err);
    return res.status(500).json({ error: "Failed", details: err.message });
  }
}
