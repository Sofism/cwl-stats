import React, { useState, lazy, Suspense } from "react";
import { Loader } from "lucide-react";
import SeasonSelector from "./components/SeasonSelector";
import ImportView from "./components/ImportView";
import Dashboard from "./components/Dashboard";
import { useSeasons } from "./hooks/useSeasons";
import { useClanNames } from "./hooks/useClanNames";

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
    reorderSeasons,
    saveStatus,
    loading,
    getSeasonsByYear,
    isSharedMode,
  } = useSeasons();

  const {
    clanNames,
    updateClanNames,
    loading: clanNamesLoading
  } = useClanNames();

  const [view, setView] = useState("selector");
  const [selectedPlayer, setSelectedPlayer] = useState(null);


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

  if (loading || clanNamesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-void-950 via-signal-900 to-void-950 flex items-center justify-center">
        <Loader className="animate-spin w-16 h-16 text-signal-500" />
      </div>
    );
  }

  if (view === "selector" || (!currentSeason && seasons.length > 0)) {
    return (
      <SeasonSelector
        seasons={seasons}
        onSelectSeason={handleSelectSeason}
        onNewSeason={handleNewSeason}
        onDeleteSeason={deleteSeason}
        onReorderSeasons={reorderSeasons}
        getSeasonsByYear={getSeasonsByYear}
        isSharedMode={isSharedMode}
        clanNames={clanNames}
        onUpdateClanNames={updateClanNames}
      />
    );
  }

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
        clanNames={clanNames}
        updateClanNames={updateClanNames}
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
        onOpenImport={() => setView("import")}
        onBackToSelector={handleBackToSelector}
        onDeleteAll={deleteAllSeasons}
        onPlayerSelect={setSelectedPlayer}
        clanNames={clanNames}
        updateClanNames={updateClanNames}
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
