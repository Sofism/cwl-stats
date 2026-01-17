import React, { useState } from "react";
import { Share2, Trash2, ArrowLeft } from "lucide-react";
import StatsCards from "./StatsCards";
import StatsTable from "./StatsTable";
import ColumnSelector from "./ColumnSelector";
import ClanTabs from "./ClanTabs";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { createShareLink } from "../utils/shareUtils";
import { BASE_BONUSES, DEFAULT_VISIBLE_COLS } from "../utils/constants";

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
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLS);
  const [showColSelector, setShowColSelector] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [shareStatus, setShareStatus] = useState("");
  const [leagueInfo, setLeagueInfo] = useState(
    currentSeason.leagueInfo || {
      main: { league: "Crystal I", position: 1, warsWon: 0 },
      secondary: { league: "Crystal I", position: 1, warsWon: 0 },
    }
  );

  // Initialize bonuses from season data
  const [selectedBonuses, setSelectedBonuses] = useState({
    main: currentSeason.bonuses?.main || [],
    secondary: currentSeason.bonuses?.secondary || []
  });

  const handleShare = async () => {
    if (!currentSeason) return;
    
    try {
      setShareStatus('⏳ Generating link...');
      const shareUrl = await createShareLink(seasons, currentSeason.id);
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `CWL Stats - ${currentSeason.name}`,
            text: `My CWL stats for ${currentSeason.name}`,
            url: shareUrl
          });
          setShareStatus('✓ Shared successfully!');
          setTimeout(() => setShareStatus(''), 3000);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('✓ Link copied to clipboard!');
      setTimeout(() => setShareStatus(''), 5000);
    } catch (error) {
      console.error('Share error:', error);
      setShareStatus('✗ Error sharing');
      setTimeout(() => setShareStatus(''), 3000);
    }
  };

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
    const baseBonus = BASE_BONUSES[info.league] || 0;
    const warsWon = info.warsWon || 0;
    return baseBonus + warsWon;
  };

  const data = getData();
  const bonusCount = getBonusCount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBackToSelector}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Seasons
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
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
              className="mt-2 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
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
              onClick={handleShare}
              className="px-4 py-2 bg-green-600 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={onOpenImport}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Update
            </button>
            <button
              onClick={() => setDeleteConfirm("ALL")}
              className="px-4 py-2 bg-red-600/20 border border-red-600 rounded-lg hover:bg-red-600/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(saveStatus || shareStatus) && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500 text-green-300">
            {shareStatus || saveStatus}
          </div>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full mb-4 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
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
    </div>
  );
};

export default Dashboard;
