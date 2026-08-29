// Se quitan las barras finales: si la variable de entorno acaba en "/",
// la URL resultante seria ".../api/coc" con doble barra y Express
// devolveria un 404 que parece de la API pero es del propio proxy.
const PROXY_URL = (process.env.REACT_APP_COC_PROXY_URL || "").replace(/\/+$/, "");
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
  const cleaned = tag
    .trim()
    .toUpperCase()
    .replace(/^#/, "")
    // Se quita cualquier signo de puntuacion o espacio pegado al copiar
    // (puntos, comas, guiones, espacios intermedios...).
    .replace(/[^A-Z0-9]/g, "")
    // Los tags de Clash of Clans nunca llevan la letra O: siempre es cero.
    .replace(/O/g, "0");
  return `#${cleaned}`;
};

// Alfabeto real de los tags de Clash of Clans. Cualquier otro caracter es
// un error de transcripcion (la I y el 1 se confunden con la L, etc.).
const VALID_TAG_CHARS = /^[0289PYLQGRJCUV]+$/;

export const describeTagProblem = (tag) => {
  const normalized = normalizeTag(tag).slice(1);
  if (!normalized) return "empty";
  if (!VALID_TAG_CHARS.test(normalized)) {
    const bad = [...new Set(normalized.split("").filter((c) => !"0289PYLQGRJCUV".includes(c)))];
    return `invalid character(s): ${bad.join(", ")}`;
  }
  return null;
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
  const tag = normalizeTag(clanTag);
  const response = await proxyFetch(`clans/${encodeURIComponent(tag)}/members`);
  if (!response.ok) {
    if (response.status === 404) {
      const problem = describeTagProblem(clanTag);
      throw new Error(
        problem
          ? `Clan tag ${tag} looks wrong (${problem}). Valid tag characters are 0 2 8 9 P Y L Q G R J C U V.`
          : `Clan ${tag} not found (404). Double-check the tag in Settings.`
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Access denied (${response.status}). Check the proxy secret, the CoC API token, and that Render's IP is whitelisted.`
      );
    }
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
