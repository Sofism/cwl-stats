import React, { useState } from "react";
import { Trophy, ArrowLeft, Filter } from "lucide-react";
import { useHistoricalSettings } from "../hooks/useHistoricalSettings";
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

const HistoricalView = ({ seasons, clanNames, onClose }) => {
  const [historicalClan, setHistoricalClan] = useState("unified");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [sortByHistorical, setSortByHistorical] = useState("default");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [activeMembersInput, setActiveMembersInput] = useState("");
  const [showActiveMembersInput, setShowActiveMembersInput] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    wars: true, missAtk: true, netStars: true, netDest: false,
    threeRate: true, offStars: false, defStars: false, seasonsCount: true,
  });

  const {
    aliases, activeMembers,
    addAlias, removeAlias,
    setActiveMembers, resetAll,
  } = useHistoricalSettings();

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

  const getAllPlayers = () => {
    const players = new Set();
    const clanKeys = historicalClan === "unified"
      ? ["mainClan", "secondaryClan"]
      : [historicalClan === "main" ? "mainClan" : "secondaryClan"];
    seasons.forEach(season => {
      clanKeys.forEach(clanKey => {
        const clanData = season[clanKey];
        if (clanData) clanData.forEach(p => {
          const resolved = aliases[p.name] || p.name;
          players.add(resolved);
        });
      });
    });
    return [...players].sort();
  };

  const isPlayerActive = (name) => (activeMembers || []).includes(name);

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
          const resolvedName = aliases[player.name] || player.name;
          if (showOnlyActive && !isPlayerActive(resolvedName)) return;

          if (!allPlayers[resolvedName]) {
            allPlayers[resolvedName] = {
              name: resolvedName,
              th: player.th,
              seasons: [],
              totalWars: 0, totalOffStars: 0, totalDefStars: 0,
              totalOffDest: 0, totalDefDest: 0, totalMissAtk: 0,
              totalMissDef: 0, totalStars3: 0,
              isActive: isPlayerActive(resolvedName),
            };
          }

          allPlayers[resolvedName].seasons.push({
            seasonName: season.name,
            clan: clanKey === "mainClan" ? "Main" : "Secondary",
            ...player, name: resolvedName,
          });
          allPlayers[resolvedName].totalWars += player.wars || 0;
          allPlayers[resolvedName].totalOffStars += player.offStars || 0;
          allPlayers[resolvedName].totalDefStars += player.defStars || 0;
          allPlayers[resolvedName].totalOffDest += player.offDest || 0;
          allPlayers[resolvedName].totalDefDest += player.defDest || 0;
          allPlayers[resolvedName].totalMissAtk += player.missAtk || 0;
          allPlayers[resolvedName].totalMissDef += player.missDef || 0;
          allPlayers[resolvedName].totalStars3 += player.stars3 || 0;
          allPlayers[resolvedName].th = Math.max(allPlayers[resolvedName].th, player.th || 0);
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

  const getPlayerEvolution = (playerName) => {
    const clanKeys = historicalClan === "unified"
      ? ["mainClan", "secondaryClan"]
      : [historicalClan === "main" ? "mainClan" : "secondaryClan"];

    return filteredSeasons.slice().reverse().map((season) => {
      let player = null;
      for (const clanKey of clanKeys) {
        const clanData = season[clanKey];
        if (clanData) {
          const found = clanData.find((p) => (aliases[p.name] || p.name) === playerName);
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

  const handleSetActiveMembers = () => {
    const names = activeMembersInput
      .split("\n")
      .map(n => n.trim())
      .filter(Boolean);
    setActiveMembers(names);
    setActiveMembersInput("");
    setShowActiveMembersInput(false);
  };

  const historicalData = getHistoricalData();
  const sortedData = getSortedData(historicalData);
  const allPlayerNames = getAllPlayers();

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Historical Stats
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">
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
                      ? "bg-purple-500/30 border-2 border-purple-500"
                      : "bg-blue-500/30 border-2 border-blue-500"
                    : "bg-gray-800 border-2 border-gray-700 hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filters Panel */}
          <div className="bg-purple-900/40 border-2 border-purple-500 rounded-lg mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between p-5 font-bold text-purple-300 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3 text-lg flex-wrap">
                <Filter className="w-6 h-6 text-purple-400" />
                Filters & Columns
                <span className="text-sm font-normal bg-purple-500/40 text-purple-200 px-3 py-1 rounded-full">
                  {filteredSeasons.length} of {seasons.length} seasons
                </span>
                {Object.keys(aliases).length > 0 && (
                  <span className="text-sm font-normal bg-blue-500/40 text-blue-200 px-3 py-1 rounded-full">
                    {Object.keys(aliases).length} merged
                  </span>
                )}
                {showOnlyActive && (
                  <span className="text-sm font-normal bg-green-500/40 text-green-200 px-3 py-1 rounded-full">
                    Active only
                  </span>
                )}
              </span>
              <span className="text-purple-400 text-xl">{showFilters ? "▼" : "▶"}</span>
            </button>

            {showFilters && (
              <div className="px-4 pb-4 space-y-5 border-t border-gray-700 pt-4">

                {/* Season Range */}
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-2">Season Range</p>
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
                          seasonFilter === value ? "bg-purple-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {seasonFilter === "manual" && (
                  <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">Select Seasons</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {seasons.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer bg-gray-900 p-2 rounded hover:bg-gray-700">
                          <input type="checkbox" checked={selectedSeasons.includes(s.id)} onChange={() => toggleSeasonSelection(s.id)} />
                          <span className="text-gray-300">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Merge Players */}
                <div className="border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-300">
                      🔀 Merge Players (name changes)
                      {Object.keys(aliases).length > 0 && (
                        <span className="ml-2 text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">
                          {Object.keys(aliases).length} merged
                        </span>
                      )}
                    </p>
                    <button onClick={() => setShowMergePanel(!showMergePanel)} className="text-xs text-purple-400 hover:text-purple-300">
                      {showMergePanel ? "▼ Hide" : "▶ Show"}
                    </button>
                  </div>

                  {showMergePanel && (
                    <div className="space-y-3">
                      {Object.entries(aliases).map(([from, to]) => (
                        <div key={from} className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded p-2 text-sm">
                          <span>
                            <span className="text-red-300 line-through">{from}</span>
                            <span className="text-gray-500 mx-2">→</span>
                            <span className="text-green-300">{to}</span>
                          </span>
                          <button onClick={() => removeAlias(from)} className="text-red-400 hover:text-red-300 text-xs ml-2">
                            ✕ Remove
                          </button>
                        </div>
                      ))}
                      <div className="bg-gray-900 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-gray-400">Merge old name → current name</p>
                        <select
                          value={mergeFrom}
                          onChange={(e) => setMergeFrom(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="">Old name (to be merged)...</option>
                          {allPlayerNames
                            .filter(p => !Object.keys(aliases).includes(p) && !Object.values(aliases).includes(p))
                            .map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <select
                          value={mergeTo}
                          onChange={(e) => setMergeTo(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                        >
                          <option value="">Current name (keep this)...</option>
                          {allPlayerNames
                            .filter(p => p !== mergeFrom && !Object.keys(aliases).includes(p))
                            .map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button
                          onClick={() => {
                            if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
                            addAlias(mergeFrom, mergeTo);
                            setMergeFrom(""); setMergeTo("");
                          }}
                          disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
                        >
                          Merge Players
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Members */}
                <div className="border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-300">
                      🟢 Active Members
                      {(activeMembers || []).length > 0 && (
                        <span className="ml-2 text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full">
                          {activeMembers.length} defined
                        </span>
                      )}
                    </p>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <span className="text-gray-400 text-xs">Show active only</span>
                      <input
                        type="checkbox"
                        checked={showOnlyActive}
                        onChange={(e) => setShowOnlyActive(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                  </div>

                 <div className="space-y-3">
  {/* Quick paste option */}
  <div>
    <button
      onClick={() => setShowActiveMembersInput(!showActiveMembersInput)}
      className="w-full text-xs bg-green-600/30 border border-green-500/50 text-green-300 py-2 rounded hover:bg-green-600/50 transition-colors"
    >
      {showActiveMembersInput ? "▼ Hide paste option" : "▶ Paste list of names"}
    </button>

    {showActiveMembersInput && (
      <div className="space-y-2 mt-2">
        <p className="text-xs text-gray-400">Paste one player name per line:</p>
        <textarea
          value={activeMembersInput}
          onChange={(e) => setActiveMembersInput(e.target.value)}
          placeholder={"PlayerName1\nPlayerName2\nPlayerName3..."}
          className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white font-mono"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSetActiveMembers}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded text-sm transition-colors"
          >
            Save Members
          </button>
          <button
            onClick={() => { setActiveMembersInput(""); setShowActiveMembersInput(false); }}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>

  {/* Checkboxes */}
  <div className="flex items-center justify-between">
    <p className="text-xs text-gray-400">Or toggle individually:</p>
    <div className="flex gap-3">
      <button
        onClick={() => setActiveMembers(allPlayerNames)}
        className="text-xs text-green-400 hover:text-green-300 font-semibold"
      >
        All ✓
      </button>
      <button
        onClick={() => setActiveMembers([])}
        className="text-xs text-red-400 hover:text-red-300 font-semibold"
      >
        None ✗
      </button>
    </div>
  </div>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
    {allPlayerNames.map(name => {
      const active = isPlayerActive(name);
      return (
        <label
          key={name}
          className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors ${
            active
              ? "bg-green-500/20 border border-green-500/50"
              : "bg-gray-900 hover:bg-gray-700 border border-transparent"
          }`}
        >
          <input
            type="checkbox"
            checked={active}
            onChange={() => {
              const updated = active
                ? (activeMembers || []).filter(n => n !== name)
                : [...(activeMembers || []), name];
              setActiveMembers(updated);
            }}
          />
          <span className={active ? "text-green-300" : "text-gray-300"}>
            {active ? "🟢 " : "⚪ "}{name}
          </span>
        </label>
      );
    })}
  </div>
</div>
                {/* Column Visibility */}
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-2">Visible Columns</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {COLUMNS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer bg-gray-900 p-2 rounded hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={visibleCols[key]}
                          onChange={() => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }))}
                        />
                        <span className="text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Reset */}
                <div className="border-t border-gray-700 pt-3">
                  <button
                    onClick={() => { if (window.confirm("Reset all merges and active members?")) resetAll(); }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    ↺ Reset all settings
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredSeasons.length < 1 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Select at least one season to see historical data.</p>
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
                    value: `${(historicalData.reduce((s, p) => s + p.threeRate, 0) / (historicalData.length || 1)).toFixed(1)}%`,
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

              <PlayerBarChart data={sortedData} />

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
                          className={`border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer ${p.isActive ? "bg-green-500/5" : ""}`}
                        >
                          <td className="p-3">
                            <span className={`font-bold ${i < 3 ? "text-yellow-400" : "text-gray-400"}`}>#{i + 1}</span>
                          </td>
                          <td className="p-3 font-semibold">
                            <span className="text-blue-400">{p.name}</span>
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
                        const clanKeys = historicalClan === "unified"
                          ? ["mainClan", "secondaryClan"]
                          : [historicalClan === "main" ? "mainClan" : "secondaryClan"];
                        const combined = clanKeys.flatMap(k => season[k] || []);
                        if (combined.length === 0) return null;
                        const avgThreeRate = combined.reduce((s, p) => s + p.threeRate, 0) / combined.length;
                        const avgNetStars = combined.reduce((s, p) => s + p.netStars, 0) / combined.length;
                        const totalMissAtk = combined.reduce((s, p) => s + p.missAtk, 0);
                        return (
                          <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/30">
                            <td className="p-3 font-semibold text-purple-400">{season.name}</td>
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
                className="mb-4 text-purple-400 hover:text-purple-300 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to rankings
              </button>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">
                  {selectedPlayer.name}
                  {selectedPlayer.isActive && <span className="ml-2 text-base">🟢 Active</span>}
                </h3>
                <p className="text-gray-400 mb-6">TH{selectedPlayer.th} • {selectedPlayer.seasonsCount} seasons</p>

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

                <PlayerLineChart
                  evolution={getPlayerEvolution(selectedPlayer.name)}
                  playerName={selectedPlayer.name}
                />

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
                      {getPlayerEvolution(selectedPlayer.name).map((s, i) => (
                        <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/30">
                          <td className="p-3 font-semibold text-purple-400">{s.season}</td>
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
