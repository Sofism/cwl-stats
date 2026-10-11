import { comparePlayers } from "./sortPlayers";

// Nombres de columna (case-insensitive) que puede usar el bot para cada
// dato que necesitamos. Se busca POR NOMBRE en la fila de cabecera, no por
// posicion fija: el export de CWL trae columnas (Attack Percentage,
// Lower/Upper TH Hits) que el de guerra normal no trae, asi que las
// posiciones se desplazan entre un formato y otro. Buscar por nombre hace
// que el mismo parser sirva para los dos, y para cualquier cambio futuro
// de columnas del bot sin volver a romperse.
const HEADER_ALIASES = {
  name: ["Name"],
  tag: ["Tag"],
  th: ["Town Hall"],
  wars: ["Wars Participated"],
  offStars: ["Total Stars"],
  offDest: ["Total Dest"],
  stars3: ["Three Stars"],
  stars2: ["Two Stars"],
  stars1: ["One Stars"],
  stars0: ["Zero Stars"],
  missAtk: ["Missed"],
  totalDef: ["Total Defenses"],
  defStars: ["Defensive Stars", "Total Def Stars"],
  defDest: ["Total Defensive Destruction", "Total Def Dest"],
  avgDistance: ["Avg. Target Distance", "Avg Target Distance"],
  // Opcionales: con las tres se separa cuantos ataques fueron contra el
  // mismo TH (ataques - dips - reaches) y contra uno superior (reaches).
  // Sin ellas el dato queda vacio.
  attacks: ["Number of Attacks"],
  dips: ["Lower TH Hits (Dips)"],
  reaches: ["Upper TH Hits (Reaches)"],
};

// Estas son imprescindibles: sin alguna de ellas no se puede calcular nada
// con garantias, mejor no leer filas que adivinar una columna equivocada.
const REQUIRED_KEYS = [
  "name", "wars", "offStars", "offDest",
  "stars3", "stars2", "stars1", "stars0",
  "missAtk", "totalDef", "defStars", "defDest",
];

/**
 * Por que parseData devolveria [] para este texto, o null si no hay
 * problema (el fallo esta en otro sitio, p. ej. ninguna fila de datos).
 * Pensado para mostrarselo al usuario: parseData() en si no explica nada,
 * solo devuelve una lista vacia, y eso ya causo una vez un pegado que no
 * parecia hacer nada sin forma de saber por que.
 */
export const describeParseProblem = (text) => {
  const rows = text
    .trim()
    .split("\n")
    .map((line) => line.split(/\t/).map((x) => x.trim()));
  if (rows.length === 0 || !text.trim()) return null;

  const headerRow = rows.find((c) => (c[0] || "").toLowerCase() === "name");
  if (!headerRow) {
    return 'No header row found: one row must have exactly "Name" as its first column.';
  }

  const indexOf = (aliases) => {
    for (const alias of aliases) {
      const idx = headerRow.findIndex((h) => h.toLowerCase() === alias.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const missing = REQUIRED_KEYS.filter((key) => indexOf(HEADER_ALIASES[key]) === -1).map(
    (key) => HEADER_ALIASES[key][0]
  );
  if (missing.length > 0) {
    return `The header row is missing these columns (or they are named differently): ${missing.join(", ")}.`;
  }
  return null;
};

export const parseData = (text, clan) => {
  const rows = text
    .trim()
    .split("\n")
    .map((line) => line.split(/\t/).map((x) => x.trim()));

  if (rows.length === 0) return [];

  const headerRow = rows.find((c) => (c[0] || "").toLowerCase() === "name");
  if (!headerRow) return [];

  const indexOf = (aliases) => {
    for (const alias of aliases) {
      const idx = headerRow.findIndex((h) => h.toLowerCase() === alias.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const columns = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    columns[key] = indexOf(aliases);
  }
  if (REQUIRED_KEYS.some((key) => columns[key] === -1)) return [];

  const data = [];
  for (const c of rows) {
    const name = c[columns.name];
    if (!name || name.toLowerCase() === "name") continue;

    const wars = parseInt(c[columns.wars]) || 0;
    const offStars = parseInt(c[columns.offStars]) || 0;
    const offDest = parseFloat(c[columns.offDest]) || 0;
    const threeStarCount = parseInt(c[columns.stars3]) || 0;
    const twoStarCount = parseInt(c[columns.stars2]) || 0;
    const oneStarCount = parseInt(c[columns.stars1]) || 0;
    const zeroStarCount = parseInt(c[columns.stars0]) || 0;
    const missAtk = parseInt(c[columns.missAtk]) || 0;
    const totalDef = parseInt(c[columns.totalDef]) || 0;
    const missDef = Math.max(0, wars - totalDef);
    const defStarsRaw = parseInt(c[columns.defStars]) || 0;
    const defDestRaw = parseFloat(c[columns.defDest]) || 0;
    const defStars = defStarsRaw + missDef * 2;
    const defDest = defDestRaw + missDef * 85;
    const avgDistance = columns.avgDistance !== -1 ? parseFloat(c[columns.avgDistance]) || 0 : 0;
    const hasSameTh = columns.attacks !== -1 && columns.dips !== -1 && columns.reaches !== -1;
    const reaches = hasSameTh ? parseInt(c[columns.reaches]) || 0 : 0;
    const sameTh = hasSameTh
      ? Math.max(
          0,
          (parseInt(c[columns.attacks]) || 0) - (parseInt(c[columns.dips]) || 0) - reaches
        )
      : undefined;

    data.push({
      name,
      tag: columns.tag !== -1 ? c[columns.tag] || undefined : undefined,
      clan,
      th: columns.th !== -1 ? parseInt(c[columns.th]) || 0 : 0,
      missAtk,
      offStars,
      offDest,
      defStars,
      defDest,
      netStars: offStars - defStars,
      netDest: offDest - defDest,
      threeRate: wars > 0 ? (threeStarCount / wars) * 100 : 0,
      wars,
      missDef,
      stars3: threeStarCount,
      stars2: twoStarCount,
      stars1: oneStarCount,
      stars0: zeroStarCount,
      avgDistance,
      ...(sameTh !== undefined ? { sameTh, higherTh: reaches } : {}),
    });
  }

  // Orden por defecto compartido: ver sortPlayers.js.
  return data.sort(comparePlayers);
};
