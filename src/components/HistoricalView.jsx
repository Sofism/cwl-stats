import React, { useState } from "react";
import { Trophy, ArrowLeft, Filter } from "lucide-react";

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

const HistoricalView = ({ seasons, clanNames, onClose }) => {
  const [historicalClan, setHistoricalClan] = useState("main");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [excludedPlayers, setExcludedPlayers] = useState([]);
  const toggleExcludePlayer = (name) => {
  setExcludedPlayers(prev =>
    prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
  );
};

  const getAllPlayers = (clanKey) => {
  const players = new Set();
  seasons.forEach(season => {
    const clanData = clanKey === "main" ? season.mainClan : season.secondaryClan;
    if (clanData) clanData.forEach(p => players.add(p.name));
  });
  return [...players].sort();
};
  const [visibleCols, setVisibleCols] = useState({
    wars: true,
    missAtk: true,
    netStars: true,
    netDest: false,
    threeRate: true,
    offStars: false,
    defStars: false,
    seasonsCount: true,
  });

  // Get filtered seasons based on filter selection
  const getFilteredSeasons = () => {
    if (seasonFilter === "manual" && selectedSeasons.length > 0) {
      return seasons.filter((s) => selectedSeasons.includes(s.id));
    }
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

  const getHistoricalData = (clanKey) => {
    const allPlayers = {};

    filteredSeasons.forEach((season) => {
      const clanData =
        clanKey === "main" ? season.mainClan : season.secondaryClan;
      if (!clanData) return;

clanData.forEach((player) => {
  if (excludedPlayers.includes(player.name)) return;
  if (!allPlayers[player.name]) {
          allPlayers[player.name] = {
            name: player.name,
            th: player.th,
            seasons: [],
            totalWars: 0,
            totalOffStars: 0,
            totalDefStars: 0,
            totalOffDest: 0,
            totalDefDest: 0,
            totalMissAtk: 0,
            totalMissDef: 0,
            totalStars3: 0,
          };
        }

        allPlayers[player.name].seasons.push({
          seasonName: season.name,
          ...player,
        });
        allPlayers[player.name].totalWars += player.wars || 0;
        allPlayers[player.name].totalOffStars += player.offStars || 0;
        allPlayers[player.name].totalDefStars += player.defStars || 0;
        allPlayers[player.name].totalOffDest += player.offDest || 0;
        allPlayers[player.name].totalDefDest += player.defDest || 0;
        allPlayers[player.name].totalMissAtk += player.missAtk || 0;
        allPlayers[player.name].totalMissDef += player.missDef || 0;
        allPlayers[player.name].totalStars3 += player.stars3 || 0;
        allPlayers[player.name].th = Math.max(
          allPlayers[player.name].th,
          player.th || 0
        );
      });
    });

    return Object.values(allPlayers)
      .map((p) => ({
        ...p,
        netStars: p.totalOffStars - p.totalDefStars,
        netDest: p.totalOffDest - p.totalDefDest,
        threeRate:
          p.totalWars > 0 ? (p.totalStars3 / p.totalWars) * 100 : 0,
        seasonsCount: p.seasons.length,
      }))
      .sort((a, b) => {
        if (a.totalMissAtk !== b.totalMissAtk)
          return a.totalMissAtk - b.totalMissAtk;
        if (b.netStars !== a.netStars) return b.netStars - a.netStars;
        return b.threeRate - a.threeRate;
      });
  };

  const getPlayerEvolution = (playerName, clanKey) => {
    return filteredSeasons
      .slice()
      .reverse()
      .map((season) => {
        const clanData =
          clanKey === "main" ? season.mainClan : season.secondaryClan;
        if (!clanData) return null;
        const player = clanData.find((p) => p.name === playerName);
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
      })
      .filter(Boolean);
  };

  const historicalData = getHistoricalData(historicalClan);
  const [sortByHistorical, setSortByHistorical] = useState("default");

const getSortedData = (data) => {
  const sorted = [...data];
  if (sortByHistorical === "threeRate") return sorted.sort((a, b) => b.threeRate - a.threeRate);
  if (sortByHistorical === "netStars") return sorted.sort((a, b) => b.netStars - a.netStars);
  if (sortByHistorical === "netDest") return sorted.sort((a, b) => b.netDest - a.netDest);
  if (sortByHistorical === "missAtk") return sorted.sort((a, b) => a.totalMissAtk - b.totalMissAtk);
  if (sortByHistorical === "wars") return sorted.sort((a, b) => b.totalWars - a.totalWars);
  if (sortByHistorical === "offStars") return sorted.sort((a, b) => b.totalOffStars - a.totalOffStars);
  if (sortByHistorical === "seasons") return sorted.sort((a, b) => b.seasonsCount - a.seasonsCount);
  return sorted; // default
};

const sortedData = getSortedData(historicalData);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Historical Stats
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Clan Selector */}
          <div className="flex gap-2 mb-4">
            {["main", "secondary"].map((clan) => (
              <button
                key={clan}
                onClick={() => {
                  setHistoricalClan(clan);
                  setSelectedPlayer(null);
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                  historicalClan === clan
                    ? clan === "main"
                      ? "bg-purple-500/30 border-2 border-purple-500"
                      : "bg-blue-500/30 border-2 border-blue-500"
                    : "bg-gray-800 border-2 border-gray-700"
                }`}
              >
                {clan === "main"
                  ? clanNames?.main || "True North"
                  : clanNames?.secondary || "DD"}
              </button>
            ))}
          </div>

        {/* Filters Panel */}
          <div className="bg-purple-900/40 border-2 border-purple-500 rounded-lg mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between p-5 font-bold text-purple-300 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3 text-lg">
                <Filter className="w-6 h-6 text-purple-400" />
                Filters & Columns
                <span className="text-sm font-normal bg-purple-500/40 text-purple-200 px-3 py-1 rounded-full">
                  {filteredSeasons.length} of {seasons.length} seasons
                </span>
              </span>
              <span className="text-purple-400 text-xl">{showFilters ? "▼" : "▶"}</span>
            </button>

            {showFilters && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-700 pt-4">

                {/* Season Filter */}
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-2">
                    Season Range
                  </p>
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
                          seasonFilter === value
                            ? "bg-purple-500 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Season Selection */}
                {seasonFilter === "manual" && (
                  <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">
                      Select Seasons
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {seasons.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 text-sm cursor-pointer bg-gray-900 p-2 rounded hover:bg-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSeasons.includes(s.id)}
                            onChange={() => toggleSeasonSelection(s.id)}
                          />
                          <span className="text-gray-300">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
{/* Player Exclusion */}
<div>
  <p className="text-sm font-semibold text-gray-300 mb-2">
    Exclude Players
    {excludedPlayers.length > 0 && (
      <span className="ml-2 text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full">
        {excludedPlayers.length} hidden
      </span>
    )}
  </p>
  {excludedPlayers.length > 0 && (
    <button
      onClick={() => setExcludedPlayers([])}
      className="mb-2 text-xs text-purple-400 hover:text-purple-300"
    >
      ↺ Show all players
    </button>
  )}
  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
    {getAllPlayers(historicalClan).map((name) => (
      <label
        key={name}
        className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors ${
          excludedPlayers.includes(name)
            ? "bg-red-500/20 border border-red-500/50"
            : "bg-gray-900 hover:bg-gray-700"
        }`}
      >
        <input
          type="checkbox"
          checked={excludedPlayers.includes(name)}
          onChange={() => toggleExcludePlayer(name)}
          className="rounded"
        />
        <span className={excludedPlayers.includes(name) ? "text-red-300 line-through" : "text-gray-300"}>
          {name}
        </span>
      </label>
    ))}
  </div>
</div>
                {/* Column Visibility */}
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-2">
                    Visible Columns
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {COLUMNS.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm cursor-pointer bg-gray-900 p-2 rounded hover:bg-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols[key]}
                          onChange={() =>
                            setVisibleCols((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                        />
                        <span className="text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {filteredSeasons.length < 1 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">
                Select at least one season to see historical data.
              </p>
            </div>
          ) : !selectedPlayer ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Seasons", value: filteredSeasons.length, color: "text-purple-400" },
                  { label: "Players", value: historicalData.length, color: "text-green-400" },
                  {
                    label: "Avg 3★ Rate",
                    value: `${(
                      historicalData.reduce((s, p) => s + p.threeRate, 0) /
                      (historicalData.length || 1)
                    ).toFixed(1)}%`,
                    color: "text-yellow-400",
                  },
                  {
                    label: "Total Wars",
                    value: historicalData.reduce((s, p) => s + p.totalWars, 0),
                    color: "text-blue-400",
                  },
                ].map(({ label, value, color }, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-sm text-gray-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Cumulative Rankings Table */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
  <div>
    <h3 className="font-bold text-lg">Cumulative Rankings</h3>
    <p className="text-sm text-gray-400">Click on a player to see their evolution</p>
  </div>
  <select
    value={sortByHistorical}
    onChange={(e) => setSortByHistorical(e.target.value)}
    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
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
                    <thead className="bg-gray-900 sticky top-0">
                      <tr className="text-left text-xs text-gray-400">
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
                          className="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                        >
                          <td className="p-3">
                            <span className={`font-bold ${i < 3 ? "text-yellow-400" : "text-gray-400"}`}>
                              #{i + 1}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-blue-400">{p.name}</td>
                          <td className="p-3">{p.th}</td>
                          {visibleCols.wars && <td className="p-3">{p.totalWars}</td>}
                          {visibleCols.missAtk && (
                            <td className="p-3">
                              {p.totalMissAtk > 0 ? (
                                <span className="text-red-400 font-bold">{p.totalMissAtk}</span>
                              ) : (
                                <span className="text-green-400">✓</span>
                              )}
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
                            <td className="p-3 text-purple-400 font-semibold">{p.threeRate.toFixed(1)}%</td>
                          )}
                          {visibleCols.offStars && <td className="p-3 text-green-400">{p.totalOffStars}</td>}
                          {visibleCols.defStars && <td className="p-3 text-red-400">{p.totalDefStars}</td>}
                          {visibleCols.seasonsCount && <td className="p-3 text-purple-400">{p.seasonsCount}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Season by Season Overview */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="font-bold text-lg">Season by Season Overview</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900">
                      <tr className="text-left text-xs text-gray-400">
                        <th className="p-3">Season</th>
                        <th className="p-3">Players</th>
                        <th className="p-3">Avg 3★%</th>
                        <th className="p-3">Avg Net ★</th>
                        <th className="p-3">Total Miss Atk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSeasons.map((season, i) => {
                        const clanData = historicalClan === "main" ? season.mainClan : season.secondaryClan;
                        if (!clanData || clanData.length === 0) return null;
                        const avgThreeRate = clanData.reduce((s, p) => s + p.threeRate, 0) / clanData.length;
                        const avgNetStars = clanData.reduce((s, p) => s + p.netStars, 0) / clanData.length;
                        const totalMissAtk = clanData.reduce((s, p) => s + p.missAtk, 0);
                        return (
                          <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/30">
                            <td className="p-3 font-semibold text-purple-400">{season.name}</td>
                            <td className="p-3">{clanData.length}</td>
                            <td className="p-3 text-yellow-400">{avgThreeRate.toFixed(1)}%</td>
                            <td className="p-3">
                              <span className={avgNetStars >= 0 ? "text-green-400" : "text-red-400"}>
                                {avgNetStars >= 0 ? "+" : ""}{avgNetStars.toFixed(1)}
                              </span>
                            </td>
                            <td className="p-3">
                              {totalMissAtk > 0 ? (
                                <span className="text-red-400 font-bold">{totalMissAtk}</span>
                              ) : (
                                <span className="text-green-400">✓ None</span>
                              )}
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
            /* Player Evolution View */
            <div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="mb-4 text-purple-400 hover:text-purple-300 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to rankings
              </button>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">{selectedPlayer.name}</h3>
                <p className="text-gray-400 mb-6">TH{selectedPlayer.th} • {selectedPlayer.seasonsCount} seasons</p>

                {/* Cumulative Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Stars Gained", value: selectedPlayer.totalOffStars, color: "text-green-400" },
                    { label: "Stars Given", value: selectedPlayer.totalDefStars, color: "text-red-400" },
                    { label: "Net Stars", value: `${selectedPlayer.netStars >= 0 ? "+" : ""}${selectedPlayer.netStars}`, color: selectedPlayer.netStars >= 0 ? "text-green-400" : "text-red-400" },
                    { label: "Avg 3★ Rate", value: `${selectedPlayer.threeRate.toFixed(1)}%`, color: "text-purple-400" },
                    { label: "Total Wars", value: selectedPlayer.totalWars, color: "text-blue-400" },
                    { label: "Missed Attacks", value: selectedPlayer.totalMissAtk, color: selectedPlayer.totalMissAtk > 0 ? "text-red-400" : "text-green-400" },
                    { label: "Net Destruction", value: `${selectedPlayer.netDest >= 0 ? "+" : ""}${selectedPlayer.netDest.toFixed(1)}%`, color: selectedPlayer.netDest >= 0 ? "text-green-400" : "text-red-400" },
                    { label: "Seasons Played", value: selectedPlayer.seasonsCount, color: "text-yellow-400" },
                  ].map(({ label, value, color }, i) => (
                    <div key={i} className="bg-gray-900 p-4 rounded-lg text-center">
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-400 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Season by Season Evolution */}
                <h4 className="font-bold text-lg mb-4 text-yellow-400">Season by Season Evolution</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900">
                      <tr className="text-left text-xs text-gray-400">
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
                      {getPlayerEvolution(selectedPlayer.name, historicalClan).map((s, i) => (
                        <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/30">
                          <td className="p-3 font-semibold text-purple-400">{s.season}</td>
                          <td className="p-3">{s.wars}</td>
                          <td className="p-3">
                            {s.missAtk > 0 ? (
                              <span className="text-red-400 font-bold">{s.missAtk}</span>
                            ) : (
                              <span className="text-green-400">✓</span>
                            )}
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
                          <td className="p-3 text-purple-400">{s.threeRate.toFixed(1)}%</td>
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
