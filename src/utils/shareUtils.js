// ============================================
// utils/shareUtils.js
// ============================================
export const loadSharedData = async (shareId, legacyData, callback) => {
  // Cargar desde API con ID corto
  if (shareId) {
    try {
      const res = await fetch(`/api/get-share?id=${shareId}`);
      if (!res.ok) throw new Error('Share not found');
      const data = await res.json();
      callback(data);
    } catch (err) {
      console.error('Error loading shared data:', err);
    }
    return;
  }

  // Soporte legacy para enlaces viejos con base64
  if (legacyData) {
    try {
      const decoded = JSON.parse(
        decodeURIComponent(escape(atob(legacyData)))
      );
      callback(decoded);
    } catch (err) {
      console.error("Error loading shared data:", err);
    }
  }
};

export const createShareLink = async (seasons, currentSeasonId) => {
  const response = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasons, currentSeasonId })
  });
  
  if (!response.ok) {
    throw new Error('Failed to create share link');
  }
  
  const { shareId } = await response.json();
  return `${window.location.origin}?share=${shareId}`;
};
