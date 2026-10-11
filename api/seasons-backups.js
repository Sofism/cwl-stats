const store = require('./_lib/seasonStore');
const { checkWriteAuth } = require('./_lib/auth');

/**
 * Copias de seguridad automaticas de las temporadas (las 5 mas recientes,
 * una antes de cada guardado que cambia algo y siempre antes de borrar).
 *
 *   GET /api/seasons-backups        lista { n, at, reason, count }
 *   GET /api/seasons-backups?n=1    devuelve { seasons } de esa copia
 *
 * Restaurar: POST /api/save-season con { seasons, replace: true }.
 * Requiere la clave de escritura si esta configurada (son todos los datos).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-write-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkWriteAuth(req, res)) return;

  try {
    const n = req.query && req.query.n;
    if (n) {
      const backup = await store.readBackup(Number(n));
      if (!backup) return res.status(404).json({ error: 'Backup not found' });
      return res.status(200).json(backup);
    }
    return res.status(200).json({ backups: await store.listBackups() });
  } catch (err) {
    console.error('Backups error:', err);
    return res.status(500).json({ error: 'Failed', details: err.message });
  }
}
