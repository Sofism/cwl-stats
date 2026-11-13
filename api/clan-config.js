const redis = require('./redis');
const { checkWriteAuth } = require('./_lib/auth');

const KEY = 'cwl-clan-config';

/**
 * Configuracion de clanes (nombres y tags) compartida entre dispositivos.
 * Antes vivia solo en localStorage, asi que habia que reintroducirla en
 * cada navegador. Guardarla aqui ademas es requisito para el cron, que
 * corre en servidor y no tiene acceso a localStorage.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-write-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const data = await redis.get(KEY);
      if (!data) return res.status(200).json({ config: null });
      // Las insignias (mainBadge/secondaryBadge) las pone el cron, no esta lectura.
      const config = typeof data === 'string' ? JSON.parse(data) : data;
      return res.status(200).json({ config });
    }

    if (req.method === 'POST') {
      if (!checkWriteAuth(req, res)) return;
      const config = req.body?.config;
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ error: 'Missing config' });
      }
      // Si cambia un tag, la insignia guardada ya no es de ese clan: se
      // descarta y la siguiente lectura la vuelve a pedir.
      const prevRaw = await redis.get(KEY);
      const prev = prevRaw ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) : {};
      const toSave = { ...config };
      if (prev.mainTag !== config.mainTag) delete toSave.mainBadge;
      if (prev.secondaryTag !== config.secondaryTag) delete toSave.secondaryBadge;
      await redis.set(KEY, JSON.stringify(toSave));
      return res.status(200).json({ ok: true, config: toSave });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Clan config error:', err);
    return res.status(500).json({ error: 'Failed', details: err.message });
  }
}
