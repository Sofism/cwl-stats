const PROXY_URL = process.env.REACT_APP_COC_PROXY_URL;
const PROXY_SECRET = process.env.REACT_APP_COC_PROXY_SECRET;

const proxyFetch = (endpointPath) =>
  fetch(`${PROXY_URL}/api/coc?endpoint=${endpointPath}`, {
    headers: PROXY_SECRET ? { "x-proxy-secret": PROXY_SECRET } : {},
  });

export const getClanMembers = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag);
    const response = await proxyFetch(`clans/${encodedTag}/members`);
    const data = await response.json();
    return data.items || [];
  } catch (err) {
    console.error('Error fetching clan members:', err);
    return [];
  }
};

export const getClanInfo = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag);
    const response = await proxyFetch(`clans/${encodedTag}`);
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
    const encodedTag = encodeURIComponent(clanTag);
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
