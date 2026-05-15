const redis = require('./redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { seasons } = req.body;
    
    if (!seasons || !Array.isArray(seasons)) {
      return res.status(400).json({ error: 'Invalid seasons data' });
    }
    
    await redis.set('cwl-seasons', JSON.stringify(seasons));
    
    res.status(200).json({ success: true, message: 'Seasons saved' });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to save data', details: err.message });
  }
};
