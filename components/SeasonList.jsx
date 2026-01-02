// ============================================
// components/SeasonList.jsx
// ============================================
import React from "react";
import { Calendar } from "lucide-react";

const SeasonList = ({ seasons, onSelectSeason, onDeleteSeason, onNewSeason }) => {
  return (
    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Seasons
        </h3>
        <button
          onClick={onNewSeason}
          className="text-sm bg-purple-500 px-3 py-1 rounded hover:bg-purple-600"
        >
          + New
        </button>
      </div>
      <div className="space-y-2">
        {seasons.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-gray-900 p-3 rounded"
          >
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-gray-400">
                {s.mainClan.length + s.secondaryClan.length} players
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onSelectSeason(s)}
                className="text-sm bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
              >
                Open
              </button>
              <button
                onClick={() => onDeleteSeason(s.id)}
                className="text-sm bg-red-500/20 border border-red-500 px-3 py-1 rounded hover:bg-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SeasonList;
