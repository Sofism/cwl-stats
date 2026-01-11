import React, { useState, useEffect, lazy, Suspense } from "react";
import { Loader } from "lucide-react";
import SeasonSelector from "./components/SeasonSelector";
import ImportView from "./components/ImportView";
import Dashboard from "./components/Dashboard";
import { useSeasons } from "./hooks/useSeasons";
import { loadSharedData } from "./utils/shareUtils";

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
    loadSharedSeasons,
    isSharedMode,
  } = useSeasons();

  const [view, setView] = useState("selector"); // "selector", "import", "dashboard"
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    const sharedData = params.get("data");

    if (shareId || sharedData) {
      loadSharedData(shareId, sharedData, (data) => {
        if (data.seasons) {
          // Cargar TODAS las temporadas compartidas en modo solo lectura
          loadSharedSeasons(data.seasons);
          
          const activeSeason = data.seasons.find(s => s.id === data.currentSeasonId) || data.seasons[0];
          setCurrentSeason(activeSeason);
          
          const hasData = (activeSeason.mainClan?.length > 0) || (activeSeason.secondaryClan?.length > 0);
          setView(hasData ? "dashboard" : "selector");
        } else if (data.season) {
          // Legacy: una sola temporada compartida
          loadSharedSeasons([data.season]);
          setCurrentSeason(data.season);
          
          const hasData = (data.season.mainClan?.length > 0) || (data.season.secondaryClan?.length > 0);
          setView(hasData ? "dashboard" : "selector");
        }
        window.history.replaceState({}, '', window.location.pathname);
      });
      return;
    }

    // Si no hay season seleccionada, mostrar selector
    if (!currentSeason && seasons.length > 0) {
      setView("selector");
    }
  }, [currentSeason, seasons, setCurrentSeason]);

  const handleSelectSeason = (season) => {
    setCurrentSeason(season);
    const hasData = (season.mainClan?.length > 0) || (season.secondaryClan?.length > 0);
    setView(hasData ? "dashboard" : "import");
  };

  const handleNewSeason = (name, year) => {
    const newSeason = addSeason(name, year);
    setCurrentSeason(newSeason);
    setView("import");
  };

  const handleBackToSelector = () => {
    setCurrentSeason(null);
    setView("selector");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader className="animate-spin w-16 h-16 text-purple-500" />
      </div>
    );
  }

  // Vista de selector de temporadas
  if (view === "selector" || (!currentSeason && seasons.length > 0)) {
    return (
      <SeasonSelector
        seasons={seasons}
        onSelectSeason={handleSelectSeason}
        onNewSeason={handleNewSeason}
        onDeleteSeason={deleteSeason}
        getSeasonsByYear={getSeasonsByYear}
        isSharedMode={isSharedMode}
      />
    );
  }

  // Vista de importación
  if (view === "import" || !currentSeason) {
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
        onClose={() => setView("dashboard")}
        onBackToSelector={handleBackToSelector}
        getSeasonsByYear={getSeasonsByYear}
      />
    );
  }

  // Vista del dashboard
  return (
    <>
      <Dashboard
        seasons={seasons}
        currentSeason={currentSeason}
        setCurrentSeason={setCurrentSeason}
        updateSeasonData={updateSeasonData}
        saveStatus={saveStatus}
        onOpenImport={() => setView("import")}
        onBackToSelector={handleBackToSelector}
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
