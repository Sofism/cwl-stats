const store = require('./_lib/seasonStore');
const { checkWriteAuth } = require('./_lib/auth');

/**
 * Guarda temporadas FUSIONANDO con lo que hay en Redis (ver seasonStore.js):
 * nunca borra por omision, asi que un cliente con la lista sin cargar o con
 * datos viejos ya no puede vaciar ni pisar nada. Devuelve la lista
 * resultante para que el cliente se ponga al dia (p. ej. con una temporada
 * creada por el sync automatico).
 *
 * Restaurar una copia de seguridad: { seasons, replace: true } sustituye
 * todo tal cual (guardando antes una copia del estado actual).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-write-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkWriteAuth(req, res)) return;

  try {
    const { seasons, replace } = req.body || {};

    if (!seasons || !Array.isArray(seasons) || seasons.some((s) => !s || typeof s.id !== 'string')) {
      return res.status(400).json({ error: 'Invalid seasons data' });
    }

    const result = await store.withLock(async () => {
      if (replace === true) {
        if (seasons.length === 0) {
          const err = new Error('Refusing to replace with an empty list; use DELETE /api/delete-season?all=1');
          err.code = 'EMPTY_REPLACE';
          throw err;
        }
        await store.snapshotSeasons('before-replace', true);
        await store.writeSeasonsRaw(seasons);
        await store.removeDeleted(
          seasons.flatMap((s) => [s.id, `cwl:${s.cwlSeason || String(s.createdAt || '').slice(0, 7)}`])
        );
        return seasons;
      }

      const current = await store.readSeasons();
      const deleted = await store.readDeleted();
      const merged = store.mergeSeasons(current, seasons, deleted);
      if (JSON.stringify(merged) !== JSON.stringify(current)) {
        await store.snapshotSeasons('before-save');
        await store.writeSeasonsRaw(merged);
      }
      return merged;
    });

    return res.status(200).json({ success: true, message: 'Seasons saved', seasons: result });
  } catch (err) {
    console.error('Save error:', err);
    const status = err.code === 'LOCKED' ? 503 : err.code === 'EMPTY_REPLACE' ? 400 : 500;
    return res.status(status).json({
      error: 'Failed to save data',
      details: err.message
    });
  }
}
