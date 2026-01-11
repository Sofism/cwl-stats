import React, { useState } from "react";
import { Share2, Trash2 } from "lucide-react";
import StatsCards from "./StatsCards";
import StatsTable from "./StatsTable";
import ColumnSelector from "./ColumnSelector";
import ClanTabs from "./ClanTabs";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { createShareLink } from "../utils/shareUtils";
import { BONUSES, DEFAULT_VISIBLE_COLS } from "../utils/constants";

const Dashboard = ({
  seasons,
  currentSeason,
  setCurrentSeason,
  updateSeasonData,
  saveStatus,
  onOpenImport,
  onDeleteAll,
  onPlayerSelect,
}) => {
  const [activePage, setActivePage] = useState("main");
  const [sortBy, setSortBy] = useState("default");
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLS);
  const [showColSelector, setShowColSelector] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [shareStatus, setShareStatus] = useState("");
  const [leagueInfo, setLeagueInfo] = useState(
    currentSeason.leagueInfo || {
      main: { league: "Crystal I", position: 1 },
      secondary: { league: "Crystal I", position: 1 },
    }
  );

  const handleShare = async () => {
    if (!currentSeason) return;
    
    try {
      setShareStatus('⏳ Generando enlace...');
      const shareUrl = await createShareLink(seasons, currentSeason.id);
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `CWL Stats - ${currentSeason.name}`,
            text: `Mis estadísticas de CWL para ${currentSeason.name}`,
            url: shareUrl
          });
          setShareStatus('✓ Compartido exitosamente!');
          setTimeout(() => setShareStatus(''), 3000);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('✓ Link copiado al portapapeles!');
      setTimeout(() => setShareStatus(''), 5000);
    } catch (error) {
      console.error('Share error:', error);
      setShareStatus('✗ Error al compartir');
      setTimeout(() => setShareStatus(''), 3000);
    }
  };

  // En Dashboard.jsx, actualiza la función getData():

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
    // Ordenamiento por defecto - DIFERENTE según el clan
    data.sort((a, b) => {
      if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
      if (b.netStars !== a.netStars) return b.netStars - a.netStars;
      
      // SOLO ordenar por avgDistance si NO es el clan principal (True North)
      if (activePage !== "main" && a.avgDistance !== b.avgDistance) {
        return a.avgDistance - b.avgDistance;
      }
      
      if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
      return b.netDest - a.netDest;
    });
  }

  const info = activePage === "main" ? leagueInfo.main : leagueInfo.secondary;
  const pos = parseInt(info.position);
  const bonusCount =
    pos >= 1 && pos <= 8
      ? (BONUSES[info.league] && BONUSES[info.league][pos - 1]) || 0
      : 0;

  return data.map((p, i) => ({
    ...p,
    getsBonus: i < bonusCount,
  }));
};

  const data = getData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
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
        />

        <StatsCards data={data} leagueInfo={leagueInfo} activePage={activePage} />

        <StatsTable
          data={data}
          visibleCols={visibleCols}
          activePage={activePage}
          onPlayerSelect={onPlayerSelect}
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
