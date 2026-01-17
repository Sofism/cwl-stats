const redis = require('../utils/redis');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Manejar OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  console.log('Share API called, method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { seasons, currentSeasonId } = req.body;
    console.log('Seasons received:', seasons ? 'Yes' : 'No');
    console.log('Number of seasons:', seasons?.length);
    
    const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.log('Generated shareId:', shareId);
    
    const key = `share:${shareId}`;
    const value = JSON.stringify({ seasons, currentSeasonId });
    console.log('Saving to key:', key);
    
    // Usar el cliente Redis adaptativo
    await redis.set(key, value, { ex: 2592000 });
    console.log('Saved successfully');
    
    return res.status(200).json({ shareId });
  } catch (error) {
    console.error('Error saving share:', error);
    return res.status(500).json({ error: 'Failed to save', details: error.message });
  }
};
