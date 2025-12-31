import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { season } = req.body;
    
    // Generar ID único corto
    const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    // Guardar en Vercel KV (expira en 30 días)
    await kv.set(`share:${shareId}`, JSON.stringify({ season }), { ex: 2592000 });
    
    return res.status(200).json({ shareId });
  } catch (error) {
    console.error('Error saving share:', error);
    return res.status(500).json({ error: 'Failed to save' });
  }
}
