import React, { useState } from "react";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";

const SeasonList = ({ seasons, onSelectSeason, onDeleteSeason, onNewSeason, getSeasonsByYear }) => {
  const [expandedYears, setExpandedYears] = useState({});
  
  const seasonsByYear = getSeasonsByYear();
  const years = Object.keys(seasonsByYear).sort((a, b) => b - a);

  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

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
      
      <div className="space-y-3">
        {years.map(year => {
          const isExpanded = expandedYears[year] !== false; // Por defecto expandido
          const yearSeasons = seasonsByYear[year];
          
          return (
            <div key={year}>
              <button
                onClick={() => toggleYear(year)}
                className="w-full flex items-center justify-between bg-gray-900 p-3 rounded hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-bold text-lg">{year}</span>
                  <span className="text-sm text-gray-400">
                    ({yearSeasons.length} season{yearSeasons.length !== 1 ? 's' : ''})
                  </span>
                </div>
              </button>
              
              {isExpanded && (
                <div className="ml-6 mt-2 space-y-2">
                  {yearSeasons.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-gray-900/50 p-3 rounded border border-gray-700"
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeasonList;
