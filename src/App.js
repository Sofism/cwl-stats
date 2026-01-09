import React, { useState, useEffect, lazy, Suspense } from "react";
import { Loader } from "lucide-react";
import ImportView from "./components/ImportView";
import Dashboard from "./components/Dashboard";
import { useSeasons } from "./hooks/useSeasons";
import { loadSharedData } from "./utils/shareUtils";

// Lazy load del modal de jugador (se carga solo cuando se necesita)
const PlayerModal = lazy(() => import("./components/PlayerModal"));

const CWLStatsTracker = () => {
  const {
    seasons,
    currentSeason,
    setCurrentSeason,
    addSeason,
    deleteSeason,
    deleteAllSeasons,
    updateSeasonData,
    saveStatus,
    loading,
    getSeasonsByYear,
  } = useSeasons();

  const [showImport, setShowImport] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    const sharedData = params.get("data");

    if (shareId || sharedData) {
      loadSharedData(shareId, sharedData, (data) => {
        if (data.seasons) {
          // Manejar datos compartidos nuevos
          const activeSeason = data.seasons.find(s => s.id === data.currentSeasonId) || data.seasons[0];
          setCurrentSeason(activeSeason);
        } else if (data.season) {
          // Manejar datos compartidos viejos
          setCurrentSeason(data.season);
        }
        setShowImport(false);
        window.history.replaceState({}, '', window.location.pathname);
      });
      return;
    }

    // Verificar si hay datos en la temporada actual
    if (currentSeason) {
      const hasData =
        (currentSeason.mainClan && currentSeason.mainClan.length > 0) ||
        (currentSeason.secondaryClan && currentSeason.secondaryClan.length > 0);
      setShowImport(!hasData);
    }
  }, [currentSeason, setCurrentSeason]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader className="animate-spin w-16 h-16 text-purple-500" />
      </div>
    );
  }

  if (showImport || !currentSeason) {
    return (
      <ImportView
        seasons={seasons}
        currentSeason={currentSeason}
        setCurrentSeason={setCurrentSeason}
        addSeason={addSeason}
        deleteSeason={deleteSeason}
        deleteAllSeasons={deleteAllSeasons}
        updateSeasonData={updateSeasonData}
        saveStatus={saveStatus}
        onClose={() => setShowImport(false)}
        getSeasonsByYear={getSeasonsByYear}
      />
    );
  }

  return (
    <>
      <Dashboard
        seasons={seasons}
        currentSeason={currentSeason}
        setCurrentSeason={setCurrentSeason}
        updateSeasonData={updateSeasonData}
        saveStatus={saveStatus}
        onOpenImport={() => setShowImport(true)}
        onDeleteAll={deleteAllSeasons}
        onPlayerSelect={setSelectedPlayer}
      />

      {selectedPlayer && (
        <Suspense fallback={null}>
          <PlayerModal
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        </Suspense>
      )}
    </>
  );
};

export default CWLStatsTracker;
