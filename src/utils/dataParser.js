// Nombres de columna (case-insensitive) que puede usar el bot para cada
// dato que necesitamos. Se busca POR NOMBRE en la fila de cabecera, no por
// posicion fija: el export de CWL trae columnas (Attack Percentage,
// Lower/Upper TH Hits) que el de guerra normal no trae, asi que las
// posiciones se desplazan entre un formato y otro. Buscar por nombre hace
// que el mismo parser sirva para los dos, y para cualquier cambio futuro
// de columnas del bot sin volver a romperse.
const HEADER_ALIASES = {
  name: ["Name"],
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
};

// Estas son imprescindibles: sin alguna de ellas no se puede calcular nada
// con garantias, mejor no leer filas que adivinar una columna equivocada.
const REQUIRED_KEYS = [
  "name", "wars", "offStars", "offDest",
  "stars3", "stars2", "stars1", "stars0",
  "missAtk", "totalDef", "defStars", "defDest",
];

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

    data.push({
      name,
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
    });
  }

  // Ordenamiento: avgDistance SOLO para clan Secondary (DD), NO para Main (True North)
  return data.sort((a, b) => {
    // 1. Prioridad: Ataques perdidos (menor es mejor)
    if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;

    // 2. Net Stars (mayor es mejor)
    if (b.netStars !== a.netStars) return b.netStars - a.netStars;

    // 3. Average Distance - SOLO si NO es "Main" (True North)
    if (a.clan !== "Main" && a.avgDistance !== b.avgDistance) {
      return a.avgDistance - b.avgDistance;
    }

    // 4. Three star rate (mayor es mejor)
    if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;

    // 5. Net destruction (mayor es mejor)
    return b.netDest - a.netDest;
  });
};
