const PROXY_URL = process.env.REACT_APP_COC_PROXY_URL;
const PROXY_SECRET = process.env.REACT_APP_COC_PROXY_SECRET;

/**
 * Los tags de Clash of Clans llevan siempre "#" delante y van en
 * mayúsculas. La gente los copia de muchas formas ("abc123", " #ABC123 "),
 * así que se normalizan aquí en vez de fallar con un 404 silencioso.
 * Además la O y el 0 se confunden al copiarlos a mano: los tags reales
 * nunca llevan la letra O, así que se sustituye por cero.
 */
export const normalizeTag = (tag) => {
  if (!tag) return "";
  const clean = tag.trim().toUpperCase().replace(/^#/, "").replace(/O/g, "0");
  return `#${clean}`;
};

const proxyFetch = (endpointPath) => {
  if (!PROXY_URL) {
    throw new Error(
      "REACT_APP_COC_PROXY_URL is not set. Add it in your Vercel environment variables and redeploy."
    );
  }
  return fetch(`${PROXY_URL}/api/coc?endpoint=${endpointPath}`, {
    headers: PROXY_SECRET ? { "x-proxy-secret": PROXY_SECRET } : {},
  });
};

export const getClanMembers = async (clanTag) => {
  const encodedTag = encodeURIComponent(normalizeTag(clanTag));
  const response = await proxyFetch(`clans/${encodedTag}/members`);
  if (!response.ok) {
    throw new Error(`Clan members request failed (${response.status})`);
  }
  const data = await response.json();
  return data.items || [];
};

export const getClanInfo = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(normalizeTag(clanTag));
    const response = await proxyFetch(`clans/${encodedTag}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Error fetching clan info:', err);
    return null;
  }
};

/**
 * Grupo de la Guerra de Liga actual: los 8 clanes del grupo y, para cada
 * ronda, los warTags necesarios para pedir el detalle de cada guerra.
 * Devuelve null si el clan no está en CWL en este momento (404 de la API).
 */
export const getCurrentWarLeagueGroup = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(normalizeTag(clanTag));
    const response = await proxyFetch(`clans/${encodedTag}/currentwar/leaguegroup`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Error fetching CWL group:', err);
    return null;
  }
};

/**
 * Detalle de una guerra concreta de la CWL (ataques, defensas, mapPosition
 * de cada miembro, etc.) a partir de un warTag devuelto por
 * getCurrentWarLeagueGroup. El warTag incluye el "#" y hay que codificarlo.
 */
export const getClanWarLeagueWar = async (warTag) => {
  try {
    const encodedTag = encodeURIComponent(warTag);
    const response = await proxyFetch(`clanwarleagues/wars/${encodedTag}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Error fetching CWL war:', err);
    return null;
  }
};
