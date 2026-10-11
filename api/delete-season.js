const store = require('./_lib/seasonStore');
const { checkWriteAuth } = require('./_lib/auth');

// Ademas del id se anota el mes de CWL de la temporada: asi el sync
// automatico no la vuelve a crear solo a la hora siguiente.
const tombstonesFor = (season) => {
  const key = season.cwlSeason || String(season.createdAt || '').slice(0, 7);
  return key ? [season.id, `cwl:${key}`] : [season.id];
};

/**
 * DELETE /api/delete-season?id=<seasonId>  borra UNA temporada.
 * DELETE /api/delete-season?all=1          borra todas.
 *
 * Sin parametros no hace nada (antes borraba todo): un borrado nunca debe
 * ser el comportamiento por defecto. Antes de borrar se guarda siempre una
 * copia de seguridad (recuperable con /api/seasons-backups).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-write-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkWriteAuth(req, res)) return;

  const id = req.query && req.query.id;
  const all = req.query && (req.query.all === '1' || req.query.all === 'true');
  if (!id && !all) {
    return res.status(400).json({ error: 'Missing id (or all=1)' });
  }

  try {
    const result = await store.withLock(async () => {
      const current = await store.readSeasons();
      if (all) {
        await store.snapshotSeasons('before-delete-all', true);
        await store.addDeleted(current.flatMap(tombstonesFor));
        await store.writeSeasonsRaw([]);
        return [];
      }
      const target = current.find((s) => s.id === id);
      if (!target) return null;
      await store.snapshotSeasons('before-delete', true);
      const remaining = current.filter((s) => s.id !== id);
      await store.addDeleted(tombstonesFor(target));
      await store.writeSeasonsRaw(remaining);
      return remaining;
    });

    if (result === null) {
      return res.status(404).json({ error: 'Season not found' });
    }
    return res.status(200).json({ success: true, seasons: result });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(err.code === 'LOCKED' ? 503 : 500).json({
      error: 'Failed to delete data',
      details: err.message
    });
  }
}
