// Vincula una temporada de la app con una CWL concreta de Clash. La API
// identifica cada liga con group.season ("2026-10"...): ese es el UNICO dato
// fiable para saber a que mes pertenece lo que se esta sincronizando, y es
// lo que evita escribir los datos de un mes encima de otro (ya paso: los de
// octubre acabaron guardados en "September" por no haber creado la nueva).
//
// Duplicado a proposito de src/utils/cwlSeasonLink.js (el cliente no puede
// importar de api/ ni al reves): cualquier cambio debe replicarse en ambos.
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10" (o "2026-10-02") -> "2026-10"; null si no tiene ese formato. */
const seasonKeyFromGroup = (group) => {
  const raw = String((group && group.season) || "");
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
};

const parts = (key) => {
  const [y, m] = key.split("-");
  return { year: Number(y), month: Number(m) };
};

const monthNameFromKey = (key) => MONTHS[parts(key).month - 1];
const yearFromKey = (key) => parts(key).year;

const seasonYear = (season) =>
  Number(season.year) || Number(String(season.createdAt || "").slice(0, 4)) || null;

/**
 * Una temporada SIN vincular (creada a mano antes de que existiera el sync
 * automatico) se considera de ese mes si se creo en ese mes, o si su nombre
 * empieza por el nombre del mes (y el año coincide): "October", "oct"...
 */
const legacyMatches = (season, key) => {
  if (season.cwlSeason) return false;
  if (String(season.createdAt || "").slice(0, 7) === key) return true;
  const { year, month } = parts(key);
  if (seasonYear(season) !== year) return false;
  const name = String(season.name || "").trim().toLowerCase();
  return name.length >= 3 && name.startsWith(MONTHS[month - 1].slice(0, 3).toLowerCase());
};

const matchesCwlSeason = (season, key) =>
  !!season && (season.cwlSeason === key || legacyMatches(season, key));

/** Exacta por vinculo; si no, la temporada sin vincular mas reciente que encaje. */
const findSeasonForKey = (seasons, key) => {
  const linked = seasons.find((s) => s.cwlSeason === key);
  if (linked) return linked;
  return (
    seasons
      .filter((s) => legacyMatches(s, key))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null
  );
};

module.exports = {
  seasonKeyFromGroup,
  monthNameFromKey,
  yearFromKey,
  matchesCwlSeason,
  findSeasonForKey,
};
