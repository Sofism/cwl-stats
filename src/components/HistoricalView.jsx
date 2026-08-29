import React, { useState, useEffect } from "react";
import { Trophy, ArrowLeft, Filter } from "lucide-react";
import { getClanMembers } from "../utils/cocApi";
import PlayerBarChart from "./PlayerBarChart";
import PlayerLineChart from "./PlayerLineChart";

const COLUMNS = [
  { key: "wars", label: "Wars" },
  { key: "missAtk", label: "Miss Atk" },
  { key: "netStars", label: "Net ★" },
  { key: "netDest", label: "Net %" },
  { key: "threeRate", label: "3★%" },
  { key: "offStars", label: "★ Gain" },
  { key: "defStars", label: "★ Give" },
  { key: "seasonsCount", label: "Seasons" },
];

const normalizeName = (name) => (name || "").trim().toLowerCase();

const HistoricalView = ({ seasons, clanNames, onClose }) => {
  const [historicalClan, setHistoricalClan] = useState("unified");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [sortByHistorical, setSortByHistorical] = useState("default");
  // Por defecto se muestran solo los miembros actuales del clan: es la
  // vista util el 90% del tiempo. Ver a todos es la excepcion.
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [visibleCols, setVisibleCols] = useState({
    wars: true, missAtk: true, netStars: true, netDest: false,
    threeRate: true, offStars: false, defStars: false, seasonsCount: true,
  });

  // Miembros activos: en vez de una lista pegada a mano, se comprueba en
  // vivo contra la API quién sigue en el clan ahora mismo (por tag).
  // Rosters separados por clan: el recuento total de los dos juntos puede
  // pasar de 50 (el maximo de UN clan), que despista. Ademas asi el filtro
  // de clan de esta vista puede aplicarse tambien a "quien esta activo".
  const [rosters, setRosters] = useState({ main: [], secondary: [] });
  const [loadingActive, setLoadingActive] = useState(false);
  const [activeError, setActiveError] = useState(null);

  useEffect(() => {
    const mainTag = clanNames?.mainTag;
    const secondaryTag = clanNames?.secondaryTag;
    if (!mainTag && !secondaryTag) return;

    setLoadingActive(true);
    setActiveError(null);
    // allSettled y no all: si UN clan falla (tag mal escrito, por ejemplo)
    // el otro se sigue cargando. Con Promise.all un solo fallo dejaba los
    // dos rosters vacios y el filtro de activos se desactivaba entero.
    Promise.allSettled([
      mainTag ? getClanMembers(mainTag) : Promise.resolve([]),
      secondaryTag ? getClanMembers(secondaryTag) : Promise.resolve([]),
    ])
      .then(([mainRes, secondaryRes]) => {
        setRosters({
          main: mainRes.status === "fulfilled" ? mainRes.value : [],
          secondary: secondaryRes.status === "fulfilled" ? secondaryRes.value : [],
        });
        const failures = [];
        if (mainRes.status === "rejected") failures.push(`Main: ${mainRes.reason?.message}`);
        if (secondaryRes.status === "rejected") failures.push(`Secondary: ${secondaryRes.reason?.message}`);
        setActiveError(failures.length ? failures.join(" · ") : null);
      })
      .finally(() => setLoadingActive(false));
  }, [clanNames?.mainTag, clanNames?.secondaryTag]);

  const getFilteredSeasons = () => {
    if (seasonFilter === "manual" && selectedSeasons.length > 0)
      return seasons.filter((s) => selectedSeasons.includes(s.id));
    if (seasonFilter === "last3") return seasons.slice(0, 3);
    if (seasonFilter === "last6") return seasons.slice(0, 6);
    return seasons;
  };

  const filteredSeasons = getFilteredSeasons();

  const toggleSeasonSelection = (id) => {
    setSelectedSeasons((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // Clave de unión entre temporadas: el tag del jugador cuando existe (viene
  // de la sincronización con la API y no cambia aunque cambie el nombre).
  // Las temporadas antiguas importadas a mano solo tienen name, así que
  // caen de vuelta a agruparse por nombre — si un jugador de esas
  // temporadas cambió de nombre en su día, aparecerá como dos entradas.
  const playerKey = (p) => p.tag || p.name;

  // "Activo" = sigue en CUALQUIERA de los dos clanes, sin importar que
  // pestana de clan se este mirando. Los jugadores se mueven entre el
  // principal y el secundario, asi que filtrar por el roster de un solo
  // clan ocultaria a gente que sigue en la comunidad.
  const relevantRoster = [...rosters.main, ...rosters.secondary];

  const activeTags = new Set(relevantRoster.map((m) => m.tag));
  const activeNames = new Set(relevantRoster.map((m) => normalizeName(m.name)));

  // Un jugador cuenta como activo si su tag esta en el roster actual. Para
  // registros antiguos sin tag se cae al nombre, que es menos fiable (dos
  // jugadores pueden llamarse igual) pero es lo unico disponible.
  const isPlayerActive = (p) =>
    p.tag ? activeTags.has(p.tag) : activeNames.has(normalizeName(p.name));

  // Si el roster todavia no ha cargado (o no hay tags configurados, o fallo
  // la API) el filtro de activos se ignora. Sin esto la tabla apareceria
  // vacia y pareceria que se han perdido los datos.
  const rosterReady = relevantRoster.length > 0;
  const activeFilterOn = showOnlyActive && rosterReady;

  const getHistoricalData = () => {
    const allPlayers = {};
    const clanKeys = historicalClan === "unified"
      ? ["mainClan", "secondaryClan"]
      : [historicalClan === "main" ? "mainClan" : "secondaryClan"];

    filteredSeasons.forEach((season) => {
      clanKeys.forEach((clanKey) => {
        const clanData = season[clanKey];
        if (!clanData) return;

        clanData.forEach((player) => {
          const key = playerKey(player);
          const active = isPlayerActive(player);
          if (activeFilterOn && !active) return;

          if (!allPlayers[key]) {
            allPlayers[key] = {
              key,
              name: player.name,
              tag: player.tag,
              th: player.th,
              seasons: [],
              totalWars: 0, totalOffStars: 0, totalDefStars: 0,
              totalOffDest: 0, totalDefDest: 0, totalMissAtk: 0,
              totalMissDef: 0, totalStars3: 0,
              isActive: active,
            };
          }

          allPlayers[key].name = player.name; // nombre más reciente
          allPlayers[key].seasons.push({
            seasonName: season.name,
            clan: clanKey === "mainClan" ? "Main" : "Secondary",
            ...player,
          });
          allPlayers[key].totalWars += player.wars || 0;
          allPlayers[key].totalOffStars += player.offStars || 0;
          allPlayers[key].totalDefStars += player.defStars || 0;
          allPlayers[key].totalOffDest += player.offDest || 0;
          allPlayers[key].totalDefDest += player.defDest || 0;
          allPlayers[key].totalMissAtk += player.missAtk || 0;
          allPlayers[key].totalMissDef += player.missDef || 0;
          allPlayers[key].totalStars3 += player.stars3 || 0;
          allPlayers[key].th = Math.max(allPlayers[key].th, player.th || 0);
        });
      });
    });

    return Object.values(allPlayers).map((p) => ({
      ...p,
      netStars: p.totalOffStars - p.totalDefStars,
      netDest: p.totalOffDest - p.totalDefDest,
      threeRate: p.totalWars > 0 ? (p.totalStars3 / p.totalWars) * 100 : 0,
      seasonsCount: p.seasons.length,
    })).sort((a, b) => {
      if (a.totalMissAtk !== b.totalMissAtk) return a.totalMissAtk - b.totalMissAtk;
      if (b.netStars !== a.netStars) return b.netStars - a.netStars;
      return b.threeRate - a.threeRate;
    });
  };

  const getPlayerEvolution = (playerKeyValue) => {
    const clanKeys = historicalClan === "unified"
      ? ["mainClan", "secondaryClan"]
      : [historicalClan === "main" ? "mainClan" : "secondaryClan"];

    return filteredSeasons.slice().reverse().map((season) => {
      let player = null;
      for (const clanKey of clanKeys) {
        const clanData = season[clanKey];
        if (clanData) {
          const found = clanData.find((p) => playerKey(p) === playerKeyValue);
          if (found) { player = found; break; }
        }
      }
      if (!player) return null;
      return {
        season: season.name,
        wars: player.wars || 0,
        threeRate: player.threeRate || 0,
        netStars: player.netStars || 0,
        netDest: player.netDest || 0,
        missAtk: player.missAtk || 0,
        offStars: player.offStars || 0,
        defStars: player.defStars || 0,
      };
    }).filter(Boolean);
  };

  const getSortedData = (data) => {
    const sorted = [...data];
    if (sortByHistorical === "threeRate") return sorted.sort((a, b) => b.threeRate - a.threeRate);
    if (sortByHistorical === "netStars") return sorted.sort((a, b) => b.netStars - a.netStars);
    if (sortByHistorical === "netDest") return sorted.sort((a, b) => b.netDest - a.netDest);
    if (sortByHistorical === "missAtk") return sorted.sort((a, b) => a.totalMissAtk - b.totalMissAtk);
    if (sortByHistorical === "wars") return sorted.sort((a, b) => b.totalWars - a.totalWars);
    if (sortByHistorical === "offStars") return sorted.sort((a, b) => b.totalOffStars - a.totalOffStars);
    if (sortByHistorical === "seasons") return sorted.sort((a, b) => b.seasonsCount - a.seasonsCount);
    return sorted;
  };

  const historicalData = getHistoricalData();
  const sortedData = getSortedData(historicalData);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-signal-400 to-steel-300 bg-clip-text text-transparent">
              Historical Stats
            </h2>
            <button onClick={onClose} className="text-ink-400 hover:text-white text-3xl leading-none">
              &times;
            </button>
          </div>

          {/* Clan Selector */}
          <div className="flex gap-2 mb-4">
            {[
              { key: "unified", label: "⚡ Unified" },
              { key: "main", label: clanNames?.main || "True North" },
              { key: "secondary", label: clanNames?.secondary || "DD" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setHistoricalClan(key); setSelectedPlayer(null); }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-colors ${
                  historicalClan === key
                    ? key === "unified"
                      ? "bg-yellow-500/30 border-2 border-yellow-500 text-yellow-300"
                      : key === "main"
                      ? "bg-signal-500/30 border-2 border-signal-500"
                      : "bg-steel-500/30 border-2 border-steel-500"
                    : "bg-void-800 border-2 border-void-700 hover:bg-void-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Toggle principal: activos vs todos */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowOnlyActive(!showOnlyActive)}
              disabled={!rosterReady}
              className={`flex-1 min-w-[240px] py-4 px-5 rounded-lg font-semibold text-base border-2 transition-colors flex items-center justify-center gap-3 ${
                activeFilterOn
                  ? "bg-green-500/20 border-green-500 text-green-300 hover:bg-green-500/30"
                  : "bg-void-800 border-void-600 text-ink-200 hover:bg-void-700"
              } ${!rosterReady ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="text-xl">{activeFilterOn ? "🟢" : "👥"}</span>
              {activeFilterOn ? "Current members only" : "All players (including former)"}
              <span className="text-sm font-normal bg-void-950/60 px-3 py-1 rounded-full">
                {sortedData.length}
              </span>
            </button>
            {!rosterReady && (
              <p className="text-xs text-ink-500 basis-full">
                {loadingActive
                  ? "Checking who is currently in the clan…"
                  : "Showing everyone — add clan tags in Settings to filter by current members."}
              </p>
            )}
          </div>

          {/* Filters Panel */}
          <div className="bg-signal-900/40 border-2 border-signal-500 rounded-lg mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between p-5 font-bold text-signal-300 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3 text-lg flex-wrap">
                <Filter className="w-6 h-6 text-signal-400" />
                Filters & Columns
                <span className="text-sm font-normal bg-signal-500/40 text-signal-200 px-3 py-1 rounded-full">
                  {filteredSeasons.length} of {seasons.length} seasons
                </span>
                {showOnlyActive && (
                  <span className="text-sm font-normal bg-green-500/40 text-green-200 px-3 py-1 rounded-full">
                    Active only
                  </span>
                )}
              </span>
              <span className="text-signal-400 text-xl">{showFilters ? "▼" : "▶"}</span>
            </button>

            {showFilters && (
              <div className="px-4 pb-4 space-y-5 border-t border-void-700 pt-4">

                {/* Season Range */}
                <div>
                  <p className="text-sm font-semibold text-ink-200 mb-2">Season Range</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "all", label: `All (${seasons.length})` },
                      { value: "last3", label: "Last 3" },
                      { value: "last6", label: "Last 6" },
                      { value: "manual", label: "Manual" },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setSeasonFilter(value)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          seasonFilter === value ? "bg-signal-500 text-white" : "bg-void-700 text-ink-200 hover:bg-void-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {seasonFilter === "manual" && (
                  <div>
                    <p className="text-sm font-semibold text-ink-200 mb-2">Select Seasons</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {seasons.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer bg-void-950 p-2 rounded hover:bg-void-700">
                          <input type="checkbox" checked={selectedSeasons.includes(s.id)} onChange={() => toggleSeasonSelection(s.id)} />
                          <span className="text-ink-200">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Members — se comprueba en vivo contra la API, ya no hay lista manual */}
                <div className="border border-void-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-200">
                      🟢 Active Members
                      <span className="ml-2 text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full">
                        {loadingActive
                          ? "checking..."
                          : `${rosters.main.length} + ${rosters.secondary.length} across both clans`}
                      </span>
                    </p>

                  </div>
                  {activeError && (
                    <p className="text-xs text-red-300 mt-2">
                      ⚠ {activeError}
                    </p>
                  )}
                  {!activeError && activeTags.size === 0 && !loadingActive && (
                    <p className="text-xs text-ink-500 mt-2">
                      Add your clan tags in Settings to track who is still in the clan.
                    </p>
                  )}
                </div>

                {/* Column Visibility */}
                <div>
                  <p className="text-sm font-semibold text-ink-200 mb-2">Visible Columns</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {COLUMNS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer bg-void-950 p-2 rounded hover:bg-void-700">
                        <input
                          type="checkbox"
                          checked={visibleCols[key]}
                          onChange={() => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }))}
                        />
                        <span className="text-ink-200">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {filteredSeasons.length < 1 ? (
            <div className="bg-void-800 border border-void-700 rounded-lg p-8 text-center">
              <Trophy className="w-16 h-16 text-ink-600 mx-auto mb-4" />
              <p className="text-ink-400 text-lg">Select at least one season to see historical data.</p>
            </div>
          ) : !selectedPlayer ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Seasons", value: filteredSeasons.length, color: "text-signal-400" },
                  { label: "Players", value: historicalData.length, color: "text-green-400" },
                  {
                    label: "Avg 3★ Rate",
                    value: `${(historicalData.reduce((s, p) => s + p.threeRate, 0) / (historicalData.length || 1)).toFixed(1)}%`,
                    color: "text-yellow-400",
                  },
                  {
                    label: "Total Wars",
                    value: historicalData.reduce((s, p) => s + p.totalWars, 0),
                    color: "text-steel-400",
                  },
                ].map(({ label, value, color }, i) => (
                  <div key={i} className="bg-void-800 border border-void-700 rounded-lg p-4 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-sm text-ink-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <PlayerBarChart data={sortedData} />

              {/* Cumulative Rankings Table */}
              <div className="bg-void-800 border border-void-700 rounded-lg overflow-hidden mb-6">
                <div className="p-4 border-b border-void-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">Cumulative Rankings</h3>
                    <p className="text-sm text-ink-400">Click on a player to see their evolution</p>
                  </div>
                  <select
                    value={sortByHistorical}
                    onChange={(e) => setSortByHistorical(e.target.value)}
                    className="bg-void-700 border border-void-600 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="default">Default Sort</option>
                    <option value="netStars">Net ★</option>
                    <option value="netDest">Net %</option>
                    <option value="threeRate">3★ Rate</option>
                    <option value="missAtk">Missed Attacks</option>
                    <option value="offStars">★ Gained</option>
                    <option value="wars">Wars Played</option>
                    <option value="seasons">Seasons Played</option>
                  </select>
                </div>
                <div className="overflow-x-auto" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="w-full text-sm">
                    <thead className="bg-void-950 sticky top-0">
                      <tr className="text-left text-xs text-ink-400">
                        <th className="p-3">Rank</th>
                        <th className="p-3">Player</th>
                        <th className="p-3">TH</th>
                        {COLUMNS.filter((c) => visibleCols[c.key]).map((c) => (
                          <th key={c.key} className="p-3">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((p, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedPlayer(p)}
                          className={`border-t border-void-700 hover:bg-void-700/50 cursor-pointer ${p.isActive ? "bg-green-500/5" : ""}`}
                        >
                          <td className="p-3">
                            <span className={`font-bold ${i < 3 ? "text-yellow-400" : "text-ink-400"}`}>#{i + 1}</span>
                          </td>
                          <td className="p-3 font-semibold">
                            <span className="text-steel-400">{p.name}</span>
                            {p.isActive && <span className="ml-1 text-xs">🟢</span>}
                          </td>
                          <td className="p-3">{p.th}</td>
                          {visibleCols.wars && <td className="p-3">{p.totalWars}</td>}
                          {visibleCols.missAtk && (
                            <td className="p-3">
                              {p.totalMissAtk > 0
                                ? <span className="text-red-400 font-bold">{p.totalMissAtk}</span>
                                : <span className="text-green-400">✓</span>}
                            </td>
                          )}
                          {visibleCols.netStars && (
                            <td className="p-3">
                              <span className={`font-bold ${p.netStars >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.netStars >= 0 ? "+" : ""}{p.netStars}
                              </span>
                            </td>
                          )}
                          {visibleCols.netDest && (
                            <td className="p-3">
                              <span className={`font-bold ${p.netDest >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.netDest >= 0 ? "+" : ""}{p.netDest.toFixed(1)}%
                              </span>
                            </td>
                          )}
                          {visibleCols.threeRate && (
                            <td className="p-3 text-signal-400 font-semibold">{p.threeRate.toFixed(1)}%</td>
                          )}
                          {visibleCols.offStars && <td className="p-3 text-green-400">{p.totalOffStars}</td>}
                          {visibleCols.defStars && <td className="p-3 text-red-400">{p.totalDefStars}</td>}
                          {visibleCols.seasonsCount && <td className="p-3 text-signal-400">{p.seasonsCount}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Season by Season Overview */}
              <div className="bg-void-800 border border-void-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-void-700">
                  <h3 className="font-bold text-lg">Season by Season Overview</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-void-950">
                      <tr className="text-left text-xs text-ink-400">
                        <th className="p-3">Season</th>
                        <th className="p-3">Players</th>
                        <th className="p-3">Avg 3★%</th>
                        <th className="p-3">Avg Net ★</th>
                        <th className="p-3">Total Miss Atk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSeasons.map((season, i) => {
                        const clanKeys = historicalClan === "unified"
                          ? ["mainClan", "secondaryClan"]
                          : [historicalClan === "main" ? "mainClan" : "secondaryClan"];
                        const combined = clanKeys.flatMap(k => season[k] || []);
                        if (combined.length === 0) return null;
                        const avgThreeRate = combined.reduce((s, p) => s + p.threeRate, 0) / combined.length;
                        const avgNetStars = combined.reduce((s, p) => s + p.netStars, 0) / combined.length;
                        const totalMissAtk = combined.reduce((s, p) => s + p.missAtk, 0);
                        return (
                          <tr key={i} className="border-t border-void-700 hover:bg-void-700/30">
                            <td className="p-3 font-semibold text-signal-400">{season.name}</td>
                            <td className="p-3">{combined.length}</td>
                            <td className="p-3 text-yellow-400">{avgThreeRate.toFixed(1)}%</td>
                            <td className="p-3">
                              <span className={avgNetStars >= 0 ? "text-green-400" : "text-red-400"}>
                                {avgNetStars >= 0 ? "+" : ""}{avgNetStars.toFixed(1)}
                              </span>
                            </td>
                            <td className="p-3">
                              {totalMissAtk > 0
                                ? <span className="text-red-400 font-bold">{totalMissAtk}</span>
                                : <span className="text-green-400">✓ None</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="mb-4 text-signal-400 hover:text-signal-300 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to rankings
              </button>

              <div className="bg-void-800 border border-void-700 rounded-lg p-6 mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">
                  {selectedPlayer.name}
                  {selectedPlayer.isActive && <span className="ml-2 text-base">🟢 Active</span>}
                </h3>
                <p className="text-ink-400 mb-6">TH{selectedPlayer.th} • {selectedPlayer.seasonsCount} seasons</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Stars Gained", value: selectedPlayer.totalOffStars, color: "text-green-400" },
                    { label: "Stars Given", value: selectedPlayer.totalDefStars, color: "text-red-400" },
                    { label: "Net Stars", value: `${selectedPlayer.netStars >= 0 ? "+" : ""}${selectedPlayer.netStars}`, color: selectedPlayer.netStars >= 0 ? "text-green-400" : "text-red-400" },
                    { label: "Avg 3★ Rate", value: `${selectedPlayer.threeRate.toFixed(1)}%`, color: "text-signal-400" },
                    { label: "Total Wars", value: selectedPlayer.totalWars, color: "text-steel-400" },
                    { label: "Missed Attacks", value: selectedPlayer.totalMissAtk, color: selectedPlayer.totalMissAtk > 0 ? "text-red-400" : "text-green-400" },
                    { label: "Net Destruction", value: `${selectedPlayer.netDest >= 0 ? "+" : ""}${selectedPlayer.netDest.toFixed(1)}%`, color: selectedPlayer.netDest >= 0 ? "text-green-400" : "text-red-400" },
                    { label: "Seasons Played", value: selectedPlayer.seasonsCount, color: "text-yellow-400" },
                  ].map(({ label, value, color }, i) => (
                    <div key={i} className="bg-void-950 p-4 rounded-lg text-center">
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-ink-400 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <PlayerLineChart
                  evolution={getPlayerEvolution(selectedPlayer.key)}
                  playerName={selectedPlayer.name}
                />

                <h4 className="font-bold text-lg mb-4 text-yellow-400">Season by Season Evolution</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-void-950">
                      <tr className="text-left text-xs text-ink-400">
                        <th className="p-3">Season</th>
                        <th className="p-3">Wars</th>
                        <th className="p-3">Miss Atk</th>
                        <th className="p-3">Net ★</th>
                        <th className="p-3">Net %</th>
                        <th className="p-3">3★%</th>
                        <th className="p-3">★ Gain</th>
                        <th className="p-3">★ Give</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPlayerEvolution(selectedPlayer.key).map((s, i) => (
                        <tr key={i} className="border-t border-void-700 hover:bg-void-700/30">
                          <td className="p-3 font-semibold text-signal-400">{s.season}</td>
                          <td className="p-3">{s.wars}</td>
                          <td className="p-3">
                            {s.missAtk > 0
                              ? <span className="text-red-400 font-bold">{s.missAtk}</span>
                              : <span className="text-green-400">✓</span>}
                          </td>
                          <td className="p-3">
                            <span className={`font-bold ${s.netStars >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {s.netStars >= 0 ? "+" : ""}{s.netStars}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`font-bold ${s.netDest >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {s.netDest >= 0 ? "+" : ""}{s.netDest.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-signal-400">{s.threeRate.toFixed(1)}%</td>
                          <td className="p-3 text-green-400">{s.offStars}</td>
                          <td className="p-3 text-red-400">{s.defStars}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoricalView;
