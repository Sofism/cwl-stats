import React from "react";
import { Trophy } from "lucide-react";
import { LEAGUES, BASE_BONUSES } from "../utils/constants";

const LeagueSettings = ({ leagueInfo, updateLeague }) => {
  const calculateTotalBonuses = (league, warsWon) => {
    const baseBonus = BASE_BONUSES[league] || 0;
    return baseBonus + (warsWon || 0);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        League Settings
      </h3>
      <div className="space-y-4">
        {["main", "secondary"].map((clan) => {
          const info = leagueInfo[clan];
          const totalBonuses = calculateTotalBonuses(info.league, info.warsWon || 0);
          
          return (
            <div key={clan} className="bg-gray-900 p-4 rounded-lg">
              <h4
                className={
                  clan === "main"
                    ? "font-semibold mb-3 text-purple-400"
                    : "font-semibold mb-3 text-blue-400"
                }
              >
                {clan === "main" ? "True North" : "DD"}
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">League</label>
                  <select
                    value={info.league}
                    onChange={(e) => {
                      const newLeagueInfo = {
                        ...leagueInfo,
                        [clan]: { ...info, league: e.target.value },
                      };
                      updateLeague(newLeagueInfo);
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    {LEAGUES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
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
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
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
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              {/* Mostrar cálculo de bonos */}
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm">
                <p className="text-yellow-400">
                  <span className="font-bold">{totalBonuses} bonuses available</span>
                  {' '}= {BASE_BONUSES[info.league] || 0} base + {info.warsWon || 0} wars won
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
