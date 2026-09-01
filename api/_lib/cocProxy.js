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
const getCurrentWar = async (clanTag) => {
  const tag = normalizeTag(clanTag);
  const response = await proxyFetch(`clans/${encodeURIComponent(tag)}/currentwar`);
  if (!response.ok) return null;
  const data = await response.json();
  if (!data || data.state === "notInWar") return null;
  return data;
};

const getPlayer = async (playerTag) => {
  const tag = normalizeTag(playerTag);
  const response = await proxyFetch(`players/${encodeURIComponent(tag)}`);
  if (!response.ok) return null;
  return response.json();
};

module.exports = { normalizeTag, getClanMembers, getCurrentWar, getPlayer };
