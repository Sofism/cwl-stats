const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Get-Share API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing share ID' });
    }
    
    const key = `share:${id}`;
    console.log('Loading from key:', key);
    
    const data = await kv.get(key);
    
    if (!data) {
      return res.status(404).json({ error: 'Share not found' });
    }
    
    // Si data es string, parsearlo
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    
    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Error loading share:', error);
    return res.status(500).json({ error: 'Failed to load', details: error.message });
  }
};