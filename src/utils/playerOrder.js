// Orden por defecto de las estadisticas de CWL (definido por Santi):
//
//   1. Menos ataques fallados primero (nadie con un fallo queda por encima
//      de alguien sin fallos).
//   2. Mas estrellas netas.
//   3. Desempate de estrellas netas: mas ataques contra un TH igual o
//      superior al propio, luego mas guerras jugadas, luego mejor 3-star rate.
//   4. Si aun hay empate: mayor destruccion neta.
//
// El nombre NUNCA desempata. Si todo coincide devolvemos 0 y Array.sort
// (estable) mantiene el orden de origen.
//
// Los campos que faltan se tratan como 0: las temporadas antiguas (pegadas
// a mano) no tienen `atkSameOrHigherTh`, asi que en ellas ese criterio
// empata para todos y se pasa al siguiente.
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

export const compareDefaultOrder = (a, b) =>
  num(a.missAtk) - num(b.missAtk) ||
  num(b.netStars) - num(a.netStars) ||
  num(b.atkSameOrHigherTh) - num(a.atkSameOrHigherTh) ||
  num(b.wars) - num(a.wars) ||
  num(b.threeRate) - num(a.threeRate) ||
  num(b.netDest) - num(a.netDest);
