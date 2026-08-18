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
