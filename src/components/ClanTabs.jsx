import React from "react";

const ClanTabs = ({ activePage, setActivePage, currentSeason, leagueInfo, clanNames }) => {
  return (
    <div className="flex gap-2 mb-6">
      {["main", "secondary"].map((page) => {
        const isActive = activePage === page;
        const isPurple = page === "main";
        const clanName = page === "main" ? clanNames.main : clanNames.secondary;
        
        return (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
              isActive
                ? isPurple
                  ? "bg-purple-500/30 border-2 border-purple-500"
                  : "bg-blue-500/30 border-2 border-blue-500"
                : "bg-gray-800 border-2 border-gray-700"
            }`}
          >
            <div>
              {clanName} (
              {currentSeason[page === "main" ? "mainClan" : "secondaryClan"].length})
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {leagueInfo[page].league} - Pos {leagueInfo[page].position}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ClanTabs;
