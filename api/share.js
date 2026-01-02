import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('Share API called, method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { season, currentSeasonId } = req.body;
    console.log('Season received:', season ? 'Yes' : 'No');
    
    const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.log('Generated shareId:', shareId);
    
    const key = `share:${shareId}`;
    const value = JSON.stringify({ seasons, currentSeasonId });
    console.log('Saving to key:', key);
    
    await kv.set(key, value, { ex: 2592000 });
    console.log('Saved successfully');
    
    return res.status(200).json({ shareId });
  } catch (error) {
    console.error('Error saving share:', error);
    return res.status(500).json({ error: 'Failed to save', details: error.message });
  }
}
