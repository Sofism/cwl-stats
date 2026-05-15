const redis = require('./redis');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo aceptar GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', receivedMethod: req.method });
  }
  
  try {
    const data = await redis.get('cwl-seasons');
    
    if (!data) {
      return res.status(200).json({ seasons: [] });
    }
    
    // Redis de Upstash puede devolver ya parseado o como string
    const seasons = typeof data === 'string' ? JSON.parse(data) : data;
    
    return res.status(200).json({ seasons });
  } catch (err) {
    console.error('Get seasons error:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch data', 
      details: err.message 
    });
  }
}
