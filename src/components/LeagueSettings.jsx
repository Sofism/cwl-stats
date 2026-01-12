import React from "react";
import { Trophy } from "lucide-react";
import { LEAGUES } from "../utils/constants";

const LeagueSettings = ({ leagueInfo, updateLeague }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        League Settings
      </h3>
      <div className="space-y-4">
        {["main", "secondary"].map((clan) => (
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
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">League</label>
                <select
                  value={leagueInfo[clan].league}
                  onChange={(e) => {
                    const newLeagueInfo = {
                      ...leagueInfo,
                      [clan]: { ...leagueInfo[clan], league: e.target.value },
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
                  Position (1-8)
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={leagueInfo[clan].position}
                  onChange={(e) => {
                    const newLeagueInfo = {
                      ...leagueInfo,
                      [clan]: {
                        ...leagueInfo[clan],
                        position: parseInt(e.target.value) || 1,
                      },
                    };
                    updateLeague(newLeagueInfo);
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeagueSettings;
