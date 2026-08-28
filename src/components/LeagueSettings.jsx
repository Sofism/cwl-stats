import React from "react";
import { Trophy } from "lucide-react";
import { LEAGUES } from "../utils/constants";
import { calculateBonusSlots } from "../utils/bonusCalculator";

const WAR_SIZES = [5, 15, 30];

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th"... (las posiciones de CWL
// van de 1 a 8, así que no hace falta cubrir los casos raros de 11-13).
const ordinal = (n) => {
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n] || "th";
  return `${n}${suffix}`;
};

const LeagueSettings = ({ leagueInfo, updateLeague, clanNames }) => {
  const calculateTotalBonuses = (league, warsWon, warSize) =>
    calculateBonusSlots({ league, warsWon, warSize: warSize || 15 });

  return (
    <div className="bg-void-800 border border-void-700 rounded-lg p-4 mb-6">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        League Settings
      </h3>
      <div className="space-y-4">
        {["main", "secondary"].map((clan) => {
          const info = leagueInfo[clan];
          const totalBonuses = calculateTotalBonuses(
            info.league,
            info.warsWon || 0,
            info.warSize || 15
          );
          const clanName = clan === "main" ? clanNames.main : clanNames.secondary;
          
          return (
            <div key={clan} className="bg-void-950 p-4 rounded-lg">
              <h4
                className={
                  clan === "main"
                    ? "font-semibold mb-3 text-signal-400"
                    : "font-semibold mb-3 text-steel-400"
                }
              >
                {clanName}
              </h4>
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-ink-400 mb-2">League</label>
                  <select
                    value={info.league}
                    onChange={(e) => {
                      const newLeagueInfo = {
                        ...leagueInfo,
                        [clan]: { ...info, league: e.target.value },
                      };
                      updateLeague(newLeagueInfo);
                    }}
                    className="w-full bg-void-800 border border-void-700 rounded px-3 py-2 text-white"
                  >
                    {LEAGUES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-ink-400 mb-2">
                    Final Position (1-8)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={info.position}
                    onChange={(e) => {
                      const newLeagueInfo = {
                        ...leagueInfo,
                        [clan]: {
                          ...info,
                          position: parseInt(e.target.value) || 1,
                        },
                      };
                      updateLeague(newLeagueInfo);
                    }}
                    className="w-full bg-void-800 border border-void-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-ink-400 mb-2">
                    Wars Won (0-7)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={info.warsWon || 0}
                    onChange={(e) => {
                      const newLeagueInfo = {
                        ...leagueInfo,
                        [clan]: {
                          ...info,
                          warsWon: parseInt(e.target.value) || 0,
                        },
                      };
                      updateLeague(newLeagueInfo);
                    }}
                    className="w-full bg-void-800 border border-void-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-ink-400 mb-2">
                    War Size
                  </label>
                  <select
                    value={info.warSize || 15}
                    onChange={(e) => {
                      const newLeagueInfo = {
                        ...leagueInfo,
                        [clan]: {
                          ...info,
                          warSize: parseInt(e.target.value),
                        },
                      };
                      updateLeague(newLeagueInfo);
                    }}
                    className="w-full bg-void-800 border border-void-700 rounded px-3 py-2 text-white"
                  >
                    {WAR_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}v{size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Bonus calculation display */}
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm">
                <p className="text-yellow-400">
                  <span className="font-bold">{totalBonuses} bonuses available</span>
                  {' '}({info.warSize || 15}v{info.warSize || 15}, {info.warsWon || 0} wars won)
                </p>
                <p className="text-ink-500 text-xs mt-1">
                  Each medal's value also scales with the final position (
                  {ordinal(info.position || 1)}).
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeagueSettings;
