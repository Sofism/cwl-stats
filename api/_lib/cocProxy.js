// Duplicado minimo (a proposito) de src/utils/cocApi.js: este archivo corre
// en el runtime serverless de Vercel, que se build por separado del bundle
// de CRA y no puede importar desde src/. Cualquier cambio a la
// normalizacion de tags o a como se llama al proxy debe replicarse en
// ambos sitios.
const PROXY_URL = (process.env.REACT_APP_COC_PROXY_URL || "").replace(/\/+$/, "");
const PROXY_SECRET = process.env.REACT_APP_COC_PROXY_SECRET;

const normalizeTag = (tag) => {
  if (!tag) return "";
  const cleaned = tag
    .trim()
    .toUpperCase()
    .replace(/^#/, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0");
  return `#${cleaned}`;
};

const proxyFetch = (endpointPath) => {
  if (!PROXY_URL) {
    throw new Error("REACT_APP_COC_PROXY_URL is not set");
  }
  return fetch(`${PROXY_URL}/api/coc?endpoint=${endpointPath}`, {
    headers: PROXY_SECRET ? { "x-proxy-secret": PROXY_SECRET } : {},
  });
};

const getClanMembers = async (clanTag) => {
  const tag = normalizeTag(clanTag);
  const response = await proxyFetch(`clans/${encodeURIComponent(tag)}/members`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
};

// Estados posibles: notInWar | preparation | inWar | warEnded
//
// Devuelve null SOLO si la API contesta que el clan no esta en guerra
// (state "notInWar"). Cualquier otra respuesta que no sea 200 (proxy dormido
// o caido, 429, 5xx, registro de guerras privado = 403...) LANZA error: antes
// se devolvia null y el cron lo tomaba por "la guerra ha desaparecido",
// guardandola a medias a mitad de batalla.
const getCurrentWar = async (clanTag) => {
  const tag = normalizeTag(clanTag);
  const r = await proxyGet(`clans/${encodeURIComponent(tag)}/currentwar`);
  if (!r.ok) {
    const reason = r.data && r.data.reason ? ` ${r.data.reason}` : "";
    throw new Error(`currentwar request failed (${r.status}${reason})`);
  }
  if (!r.data || r.data.state === "notInWar") return null;
  return r.data;
};

/**
 * Historial OFICIAL de guerras del clan (solo resumenes: resultado, estrellas,
 * destruccion, ataques usados; nunca datos por jugador). Devuelve null si
 * falla o el registro es privado, para no confundirlo con "sin guerras".
 * Sin "?limit=": la API ya devuelve un historial largo y se recorta aqui.
 */
const getWarLog = async (clanTag) => {
  const r = await proxyGet(`clans/${encodeURIComponent(normalizeTag(clanTag))}/warlog`);
  return r.ok && r.data ? r.data.items || [] : null;
};

const getPlayer = async (playerTag) => {
  const tag = normalizeTag(playerTag);
  const response = await proxyFetch(`players/${encodeURIComponent(tag)}`);
  if (!response.ok) return null;
  return response.json();
};

// Como proxyFetch pero devolviendo status + cuerpo, para poder distinguir
// "esta peticion dio 404" (p. ej. el clan no esta en CWL) de un fallo real
// del proxy o de la API de Clash (5xx, 429, red caida), que NO deben
// tratarse como "no hay datos".
const proxyGet = async (endpointPath) => {
  const response = await proxyFetch(endpointPath);
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  return { status: response.status, ok: response.ok, data };
};

const getClanInfo = async (clanTag) => {
  const r = await proxyGet(`clans/${encodeURIComponent(normalizeTag(clanTag))}`);
  return r.ok ? r.data : null;
};

/** { status, ok, data }: status 404 = el clan no tiene grupo de CWL ahora. */
const getLeagueGroup = (clanTag) =>
  proxyGet(`clans/${encodeURIComponent(normalizeTag(clanTag))}/currentwar/leaguegroup`);

const getLeagueWar = (warTag) => proxyGet(`clanwarleagues/wars/${encodeURIComponent(warTag)}`);

module.exports = {
  normalizeTag,
  getClanMembers,
  getCurrentWar,
  getPlayer,
  getClanInfo,
  getLeagueGroup,
  getLeagueWar,
  proxyGet,
  getWarLog,
};
