// Legend y Titan: Santi las dio como un solo nivel, sin I/II/III (a
// diferencia de Bronze-Champion, que si se subdividen). Sin confirmar si
// el juego realmente las subdivide tambien - ajustar si no es asi.
export const LEAGUES = [
  "Legend",
  "Titan",
  "Champion I",
  "Champion II",
  "Champion III",
  "Master I",
  "Master II",
  "Master III",
  "Crystal I",
  "Crystal II",
  "Crystal III",
  "Gold I",
  "Gold II",
  "Gold III",
  "Silver I",
  "Silver II",
  "Silver III",
  "Bronze I",
  "Bronze II",
  "Bronze III",
];

// Bonos base por liga en 15v15 (tabla oficial dada por Santi, 2026-09).
export const BASE_BONUSES = {
  Legend: 6,
  Titan: 5,
  "Champion I": 4,
  "Champion II": 4,
  "Champion III": 4,
  "Master I": 3,
  "Master II": 3,
  "Master III": 3,
  "Crystal I": 2,
  "Crystal II": 2,
  "Crystal III": 2,
  "Gold I": 2,
  "Gold II": 2,
  "Gold III": 2,
  "Silver I": 1,
  "Silver II": 1,
  "Silver III": 1,
  "Bronze I": 1,
  "Bronze II": 1,
  "Bronze III": 1,
};

// 30v30 dobla el bono base, pero SOLO existe hasta Master - Champion,
// Titan y Legend son exclusivamente 15v15 (tabla oficial dada por Santi).
// Por eso este mapa no tiene esas ligas: si alguien selecciona 30v30 en
// una de ellas, calculateBonusSlots cae al valor de 15v15 porque no hay
// una cifra de 30v30 real para ese caso (no existe en el juego).
export const BASE_BONUSES_30V30 = {
  "Master I": 6,
  "Master II": 6,
  "Master III": 6,
  "Crystal I": 4,
  "Crystal II": 4,
  "Crystal III": 4,
  "Gold I": 4,
  "Gold II": 4,
  "Gold III": 4,
  "Silver I": 2,
  "Silver II": 2,
  "Silver III": 2,
  "Bronze I": 2,
  "Bronze II": 2,
  "Bronze III": 2,
};

// Medallas por bono según liga. Legend y Titan no estan todavia: si se
// selecciona alguna, calculateMedalValue cae a 0 (sin valor inventado).
// Falta el dato real de esas dos ligas.
export const MEDAL_VALUES = {
  "Champion I": 105,
  "Champion II": 100,
  "Champion III": 95,
  "Master I": 90,
  "Master II": 85,
  "Master III": 80,
  "Crystal I": 75,
  "Crystal II": 70,
  "Crystal III": 65,
  "Gold I": 60,
  "Gold II": 55,
  "Gold III": 50,
  "Silver I": 45,
  "Silver II": 40,
  "Silver III": 40,
  "Bronze I": 35,
  "Bronze II": 35,
  "Bronze III": 35,
};

export const DEFAULT_VISIBLE_COLS = {
  th: false,
  wars: true,
  missAtk: true,
  missDef: false,
  netStars: true,
  netPercent: false,
  threeRate: true,
  starGain: true,
  percentGain: false,
  starGive: true,
  percentGive: false,
};
