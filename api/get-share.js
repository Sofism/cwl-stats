import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;
  console.log('Get-share API called with id:', id);
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }
  
  try {
    const key = `share:${id}`;
    console.log('Looking for key:', key);
    
    const data = await kv.get(key);
    console.log('Data found:', data ? 'Yes' : 'No');
    
    if (!data) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    console.log('Returning parsed data');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error getting share:', error);
    return res.status(500).json({ error: 'Failed to load', details: error.message });
  }
}
