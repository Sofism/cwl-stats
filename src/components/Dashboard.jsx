import React, { useState, useEffect } from "react";
import StatsCards from "./StatsCards";
import StatsTable from "./StatsTable";
import ColumnSelector from "./ColumnSelector";
import ClanTabs from "./ClanTabs";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { DEFAULT_VISIBLE_COLS } from "../utils/constants";
import { calculateBonusSlots } from "../utils/bonusCalculator";
import HistoricalView from "./HistoricalView";
import CurrentWarView from "./CurrentWarView";
import { Trash2, ArrowLeft, Trophy,
  Swords,
} from "lucide-react";

const Dashboard = ({
  seasons,
  currentSeason,
  setCurrentSeason,
  updateSeasonData,
  saveStatus,
  onOpenImport,
  onBackToSelector,
  onDeleteAll,
  onPlayerSelect,
  clanNames,
}) => {
  const [activePage, setActivePage] = useState("main");
  const [sortBy, setSortBy] = useState("default");
  // Las columnas elegidas se recuerdan entre sesiones. Se fusiona con los
  // valores por defecto para que las columnas nuevas aparezcan aunque haya
  // una preferencia guardada de antes.
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem("cwl-visible-cols");
      return saved
        ? { ...DEFAULT_VISIBLE_COLS, ...JSON.parse(saved) }
        : DEFAULT_VISIBLE_COLS;
    } catch {
      return DEFAULT_VISIBLE_COLS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("cwl-visible-cols", JSON.stringify(visibleCols));
    } catch {
      // sin localStorage: simplemente no se recuerda
    }
  }, [visibleCols]);
  const [showColSelector, setShowColSelector] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showCurrentWar, setShowCurrentWar] = useState(false);
  const [leagueInfo, setLeagueInfo] = useState(
    currentSeason.leagueInfo || {
      main: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
      secondary: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
    }
  );

  // Initialize bonuses from season data
  const [selectedBonuses, setSelectedBonuses] = useState({
    main: currentSeason.bonuses?.main || [],
    secondary: currentSeason.bonuses?.secondary || []
  });



  const handleToggleBonus = (playerName) => {
    const currentBonuses = selectedBonuses[activePage];
    const newBonuses = currentBonuses.includes(playerName)
      ? currentBonuses.filter(name => name !== playerName)
      : [...currentBonuses, playerName];
    
    const updatedBonuses = {
      ...selectedBonuses,
      [activePage]: newBonuses
    };
    
    setSelectedBonuses(updatedBonuses);
    
    // Save to season
    const updatedSeason = {
      ...currentSeason,
      bonuses: updatedBonuses
    };
    updateSeasonData(updatedSeason);
  };

  const getData = () => {
    const sourceData =
      activePage === "main"
        ? currentSeason.mainClan
        : currentSeason.secondaryClan;
    let data = [...sourceData];

    if (sortBy === "netStars") {
      data.sort((a, b) => b.netStars - a.netStars);
    } else if (sortBy === "netPercent") {
      data.sort((a, b) => b.netDest - a.netDest);
    } else if (sortBy === "threeRate") {
      data.sort((a, b) => b.threeRate - a.threeRate);
    } else if (sortBy === "missAtk") {
      data.sort((a, b) => a.missAtk - b.missAtk);
    } else {
      // Default sorting - Different for Main and Secondary
      data.sort((a, b) => {
        if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
        if (b.netStars !== a.netStars) return b.netStars - a.netStars;
        if (activePage !== "main" && a.avgDistance !== b.avgDistance) {
          return a.avgDistance - b.avgDistance;
        }
        if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
        return b.netDest - a.netDest;
      });
    }

    return data;
  };

  const getBonusCount = () => {
    const info = activePage === "main" ? leagueInfo.main : leagueInfo.secondary;
    return calculateBonusSlots({
      league: info.league,
      warsWon: info.warsWon,
      warSize: info.warSize || 15,
    });
  };

  const data = getData();
  const bonusCount = getBonusCount();

  return (
    <div className="min-h-screen bg-surface-950 text-txt-mid p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBackToSelector}
 className="mb-4 flex items-center gap-2 text-txt-low hover:text-txt-hi transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Seasons
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-wide text-txt-hi">
              CWL Performance
            </h1>
            <select
              value={currentSeason.id}
              onChange={(e) => {
                const s = seasons.find((x) => x.id === e.target.value);
                setCurrentSeason(s);
                if (s && s.leagueInfo) setLeagueInfo(s.leagueInfo);
                if (s && s.bonuses) setSelectedBonuses(s.bonuses);
              }}
 className="mt-2 bg-surface-800 border border-line rounded px-3 py-1 text-sm text-txt-hi"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
  <button
    onClick={() => setShowCurrentWar(true)}
 className="px-4 py-2 bg-surface-700 border border-accent-400/40 rounded-md hover:bg-surface-700 transition-colors flex items-center gap-2"
  >
    <Swords className="w-4 h-4 text-accent-400" />
    Current War
  </button>
  <button
    onClick={() => setShowHistorical(true)}
 className="px-4 py-2 border border-line-strong rounded-md hover:border-accent-400 transition-all flex items-center gap-2"
  >
    <Trophy className="w-4 h-4" />
    Historical
  </button>

  <button
    onClick={onOpenImport}
 className="px-4 py-2 border border-line rounded-md hover:bg-surface-700 transition-colors"
  >
    Update
  </button>
  <button
    onClick={() => setDeleteConfirm("ALL")}
 className="px-4 py-2 bg-bad-900/50 border border-bad-400/40 rounded-md hover:bg-bad-900/60 transition-colors"
  >
    <Trash2 className="w-4 h-4" />
  </button>
</div>
        </div>

        {saveStatus && (
          <div className="mb-4 p-3 rounded-md bg-ok-900/50 border border-ok-400/40 text-ok-400">
            {saveStatus}
          </div>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
 className="w-full mb-4 bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi"
        >
          <option value="default">Default Sort</option>
          <option value="netStars">Net Stars</option>
          <option value="netPercent">Net %</option>
          <option value="threeRate">3★ Hitrate</option>
          <option value="missAtk">Missed Attacks</option>
        </select>

        <ColumnSelector
          visibleCols={visibleCols}
          setVisibleCols={setVisibleCols}
          showColSelector={showColSelector}
          setShowColSelector={setShowColSelector}
        />

        <ClanTabs
          activePage={activePage}
          setActivePage={setActivePage}
          currentSeason={currentSeason}
          leagueInfo={leagueInfo}
          clanNames={clanNames}
        />

        <StatsCards 
          data={data} 
          leagueInfo={leagueInfo} 
          activePage={activePage}
          bonusCount={bonusCount}
        />

        <StatsTable
          data={data}
          visibleCols={visibleCols}
          activePage={activePage}
          onPlayerSelect={onPlayerSelect}
          onToggleBonus={handleToggleBonus}
          bonusCount={bonusCount}
          selectedBonuses={selectedBonuses[activePage]}
        />

        {deleteConfirm && (
          <DeleteConfirmModal
            onConfirm={() => {
              setDeleteConfirm(null);
              onDeleteAll();
            }}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </div>
      {showCurrentWar && (
        <CurrentWarView
          clanTag={activePage === "main" ? clanNames.mainTag : clanNames.secondaryTag}
          clanName={activePage === "main" ? clanNames.main : clanNames.secondary}
          onClose={() => setShowCurrentWar(false)}
        />
      )}
      {showHistorical && (
  <HistoricalView
    seasons={seasons}
    clanNames={clanNames}
    onClose={() => setShowHistorical(false)}
  />
)}
    </div>
  );
};

export default Dashboard;
