// ============================================
// utils/dataParser.js
// ============================================
export const parseData = (text, clan) => {
  const lines = text.trim().split("\n");
  const data = [];

  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].split(/\t/).map((x) => x.trim());
    if (c[0] === "Name" || !c[0] || c.length < 26) continue;

    const wars = parseInt(c[3]) || 0;
    const offStars = parseInt(c[6]) || 0;
    const offDest = parseFloat(c[10]) || 0;
    const threeStarCount = parseInt(c[12]) || 0;
    const twoStarCount = parseInt(c[13]) || 0;
    const oneStarCount = parseInt(c[14]) || 0;
    const zeroStarCount = parseInt(c[15]) || 0;
    const missAtk = parseInt(c[16]) || 0;
    const totalDef = parseInt(c[17]) || 0;
    const missDef = Math.max(0, wars - totalDef);
    const defStarsRaw = parseInt(c[18]) || 0;
    const defDestRaw = parseFloat(c[20]) || 0;
    const defStars = defStarsRaw + missDef * 2;
    const defDest = defDestRaw + missDef * 85;
    const avgDistance = parseFloat(c[25]) || 0;

    data.push({
      name: c[0],
      clan: clan,
      th: parseInt(c[2]) || 0,
      missAtk: missAtk,
      offStars: offStars,
      offDest: offDest,
      defStars: defStars,
      defDest: defDest,
      netStars: offStars - defStars,
      netDest: offDest - defDest,
      threeRate: wars > 0 ? (threeStarCount / wars) * 100 : 0,
      wars: wars,
      missDef: missDef,
      stars3: threeStarCount,
      stars2: twoStarCount,
      stars1: oneStarCount,
      stars0: zeroStarCount,
      avgDistance: avgDistance,
    });
  }

  return data.sort((a, b) => {
    if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
    if (b.netStars !== a.netStars) return b.netStars - a.netStars;
    if (a.avgDistance !== b.avgDistance) return a.avgDistance - b.avgDistance;
    if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
    return b.netDest - a.netDest;
  });
};
