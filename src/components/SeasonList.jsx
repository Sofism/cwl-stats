import React from "react";
import { Calendar } from "lucide-react";

const SeasonList = ({ seasons, onSelectSeason, onDeleteSeason, onNewSeason }) => {
  return (
    <div className="mb-6 bg-void-800 border border-void-700 rounded-lg p-4">
      <div className="flex justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Seasons
        </h3>
        <button
          onClick={onNewSeason}
          className="text-sm bg-signal-500 px-3 py-1 rounded hover:bg-signal-600"
        >
          + New
        </button>
      </div>
      <div className="space-y-2">
        {seasons.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-void-950 p-3 rounded"
          >
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-ink-400">
                {s.mainClan.length + s.secondaryClan.length} players
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onSelectSeason(s)}
                className="text-sm bg-steel-500 px-3 py-1 rounded hover:bg-steel-600"
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
