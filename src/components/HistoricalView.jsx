import React, { useState } from "react";
import { Trophy, ArrowLeft } from "lucide-react";

const HistoricalView = ({ seasons, clanNames, onClose }) => {
  const [historicalClan, setHistoricalClan] = useState("main");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const getHistoricalData = (clanKey) => {
    const allPlayers = {};

    seasons.forEach((season) => {
      const clanData =
        clanKey === "main" ? season.mainClan : season.secondaryClan;
      if (!clanData) return;

      clanData.forEach((player) => {
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
    return seasons
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
          <div className="flex gap-2 mb-6">
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
                  : clanNames?.secondary || "DD"}{" "}
                — {seasons.length} seasons
              </button>
            ))}
          </div>

          {seasons.length < 2 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">
                You need at least 2 seasons to see historical data.
              </p>
            </div>
          ) : !selectedPlayer ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Total Seasons",
                    value: seasons.length,
                    color: "text-purple-400",
                  },
                  {
                    label: "Total Players",
                    value: historicalData.length,
                    color: "text-green-400",
                  },
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
                    value: historicalData.reduce(
                      (s, p) => s + p.totalWars,
                      0
                    ),
                    color: "text-blue-400",
                  },
                ].map(({ label, value, color }, i) => (
                  <div
                    key={i}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center"
                  >
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-sm text-gray-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Cumulative Rankings Table */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="font-bold text-lg">Cumulative Rankings</h3>
                  <p className="text-sm text-gray-400">
                    Click on a player to see their evolution
                  </p>
                </div>
                <div
                  className="overflow-x-auto"
                  style={{ maxHeight: "400px", overflowY: "auto" }}
                >
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900 sticky top-0">
                      <tr className="text-left text-xs text-gray-400">
                        <th className="p-3">Rank</th>
                        <th className="p-3">Player</th>
                        <th className="p-3">TH</th>
                        <th className="p-3">Seasons</th>
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
                      {historicalData.map((p, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedPlayer(p)}
                          className="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                        >
                          <td className="p-3">
                            <span
                              className={`font-bold ${
                                i < 3 ? "text-yellow-400" : "text-gray-400"
                              }`}
                            >
                              #{i + 1}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-blue-400 hover:text-blue-300">
                            {p.name}
                          </td>
                          <td className="p-3">{p.th}</td>
                          <td className="p-3 text-purple-400">
                            {p.seasonsCount}
                          </td>
                          <td className="p-3">{p.totalWars}</td>
                          <td className="p-3">
                            {p.totalMissAtk > 0 ? (
                              <span className="text-red-400 font-bold">
                                {p.totalMissAtk}
                              </span>
                            ) : (
                              <span className="text-green-400">✓</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`font-bold ${
                                p.netStars >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {p.netStars >= 0 ? "+" : ""}
                              {p.netStars}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`font-bold ${
                                p.netDest >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {p.netDest >= 0 ? "+" : ""}
                              {p.netDest.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-purple-400 font-semibold">
                            {p.threeRate.toFixed(1)}%
                          </td>
                          <td className="p-3 text-green-400">
                            {p.totalOffStars}
                          </td>
                          <td className="p-3 text-red-400">
                            {p.totalDefStars}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Season by Season Overview */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="font-bold text-lg">
                    Season by Season Overview
                  </h3>
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
                      {seasons.map((season, i) => {
                        const clanData =
                          historicalClan === "main"
                            ? season.mainClan
                            : season.secondaryClan;
                        if (!clanData || clanData.length === 0) return null;
                        const avgThreeRate =
                          clanData.reduce((s, p) => s + p.threeRate, 0) /
                          clanData.length;
                        const avgNetStars =
                          clanData.reduce((s, p) => s + p.netStars, 0) /
                          clanData.length;
                        const totalMissAtk = clanData.reduce(
                          (s, p) => s + p.missAtk,
                          0
                        );
                        return (
                          <tr
                            key={i}
                            className="border-t border-gray-700 hover:bg-gray-700/30"
                          >
                            <td className="p-3 font-semibold text-purple-400">
                              {season.name}
                            </td>
                            <td className="p-3">{clanData.length}</td>
                            <td className="p-3 text-yellow-400">
                              {avgThreeRate.toFixed(1)}%
                            </td>
                            <td className="p-3">
                              <span
                                className={
                                  avgNetStars >= 0
                                    ? "text-green-400"
                                    : "text-red-400"
                                }
                              >
                                {avgNetStars >= 0 ? "+" : ""}
                                {avgNetStars.toFixed(1)}
                              </span>
                            </td>
                            <td className="p-3">
                              {totalMissAtk > 0 ? (
                                <span className="text-red-400 font-bold">
                                  {totalMissAtk}
                                </span>
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
                <h3 className="text-2xl font-bold text-white mb-1">
                  {selectedPlayer.name}
                </h3>
                <p className="text-gray-400 mb-6">
                  TH{selectedPlayer.th} • {selectedPlayer.seasonsCount} seasons
                </p>

                {/* Cumulative Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: "Stars Gained",
                      value: selectedPlayer.totalOffStars,
                      color: "text-green-400",
                    },
                    {
                      label: "Stars Given",
                      value: selectedPlayer.totalDefStars,
                      color: "text-red-400",
                    },
                    {
                      label: "Net Stars",
                      value: `${selectedPlayer.netStars >= 0 ? "+" : ""}${selectedPlayer.netStars}`,
                      color:
                        selectedPlayer.netStars >= 0
                          ? "text-green-400"
                          : "text-red-400",
                    },
                    {
                      label: "Avg 3★ Rate",
                      value: `${selectedPlayer.threeRate.toFixed(1)}%`,
                      color: "text-purple-400",
                    },
                    {
                      label: "Total Wars",
                      value: selectedPlayer.totalWars,
                      color: "text-blue-400",
                    },
                    {
                      label: "Missed Attacks",
                      value: selectedPlayer.totalMissAtk,
                      color:
                        selectedPlayer.totalMissAtk > 0
                          ? "text-red-400"
                          : "text-green-400",
                    },
                    {
                      label: "Net Destruction",
                      value: `${selectedPlayer.netDest >= 0 ? "+" : ""}${selectedPlayer.netDest.toFixed(1)}%`,
                      color:
                        selectedPlayer.netDest >= 0
                          ? "text-green-400"
                          : "text-red-400",
                    },
                    {
                      label: "Seasons Played",
                      value: selectedPlayer.seasonsCount,
                      color: "text-yellow-400",
                    },
                  ].map(({ label, value, color }, i) => (
                    <div
                      key={i}
                      className="bg-gray-900 p-4 rounded-lg text-center"
                    >
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-400 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Season by Season Evolution */}
                <h4 className="font-bold text-lg mb-4 text-yellow-400">
                  Season by Season Evolution
                </h4>
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
                      {getPlayerEvolution(
                        selectedPlayer.name,
                        historicalClan
                      ).map((s, i) => (
                        <tr
                          key={i}
                          className="border-t border-gray-700 hover:bg-gray-700/30"
                        >
                          <td className="p-3 font-semibold text-purple-400">
                            {s.season}
                          </td>
                          <td className="p-3">{s.wars}</td>
                          <td className="p-3">
                            {s.missAtk > 0 ? (
                              <span className="text-red-400 font-bold">
                                {s.missAtk}
                              </span>
                            ) : (
                              <span className="text-green-400">✓</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`font-bold ${
                                s.netStars >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {s.netStars >= 0 ? "+" : ""}
                              {s.netStars}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`font-bold ${
                                s.netDest >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {s.netDest >= 0 ? "+" : ""}
                              {s.netDest.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-purple-400">
                            {s.threeRate.toFixed(1)}%
                          </td>
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
