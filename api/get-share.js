import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    const data = await kv.get(`share:${id}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(JSON.parse(data));
  } catch (error) {
    console.error('Error getting share:', error);
    return res.status(500).json({ error: 'Failed to load' });
  }
}
