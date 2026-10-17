import React from "react";
import ClanCrest from "./ClanCrest";

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
 className={`flex-1 py-3 px-4 rounded-md font-semibold ${
              isActive
                ? isPurple
                  ? "bg-accent-900 border-2 border-accent-400"
                  : "bg-surface-700 border-2 border-steel-500"
                : "bg-surface-800 border-2 border-line"
            }`}
          >
            <div className="inline-flex items-center justify-center gap-2">
              <ClanCrest url={page === "main" ? clanNames.mainBadge : clanNames.secondaryBadge} />
              <span>
                {clanName} (
                {currentSeason[page === "main" ? "mainClan" : "secondaryClan"].length})
              </span>
            </div>
            <div className="text-xs text-txt-low mt-1">
              {leagueInfo[page].league} - Pos {leagueInfo[page].position}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ClanTabs;
