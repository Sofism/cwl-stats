import React, { useState } from "react";
import { Trophy, Calendar, Plus, Play, Settings, Trash2 } from "lucide-react";
import NewSeasonModal from "./NewSeasonModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import SettingsModal from "./SettingsModal";
import HistoricalView from "./HistoricalView";

const SeasonSelector = ({ 
  seasons, 
  onSelectSeason, 
  onNewSeason, 
  onDeleteSeason,
  onReorderSeasons,
  getSeasonsByYear,
  isSharedMode,
  clanNames,
  onUpdateClanNames
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // La temporada elegida en el desplegable (por defecto, la primera).
  const [pickedSeasonId, setPickedSeasonId] = useState(seasons[0]?.id || "");
  const [showHistorical, setShowHistorical] = useState(false);

  const seasonsByYear = getSeasonsByYear();
  const years = Object.keys(seasonsByYear).sort((a, b) => b - a);


  const handleDeleteConfirm = () => {
    onDeleteSeason(deleteConfirm);
    setDeleteConfirm(null);
  };



  // Drag and drop handlers






  return (
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-signal-900 to-void-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with Settings Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-void-800 hover:bg-void-700 border border-void-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-5xl font-bold tracking-wide bg-gradient-to-r from-signal-400 to-steel-300 bg-clip-text text-transparent mb-2">
            CWL Stats Tracker
          </h1>
          <p className="text-ink-400 text-lg">
            {isSharedMode 
              ? "Viewing shared seasons (read-only)" 
              : "Select or create a season to get started"}
          </p>
        </div>

        {/* Shared Mode Banner */}
        {isSharedMode && (
          <div className="mb-6 p-4 bg-steel-500/20 border border-steel-500 rounded-lg text-center">
            <p className="text-steel-300 font-semibold">
              👀 You're viewing shared data. Changes won't be saved.
            </p>
          </div>
        )}

        {/* Create New Season and Share All Buttons */}
       <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
  <button
    onClick={() => setShowModal(true)}
    className="flex-1 bg-gradient-to-b from-signal-500 to-signal-700 hover:from-signal-400 hover:to-signal-600 border border-signal-400/40 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-signal-900/40"
  >
    <Plus className="w-6 h-6" />
    <span className="text-lg">Create New Season</span>
  </button>
  
  {seasons.length > 1 && (
    <button
      onClick={() => setShowHistorical(true)}
      className="bg-gradient-to-b from-void-700 to-void-800 hover:from-void-600 hover:to-void-700 border border-signal-500/40 text-signal-200 font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg"
    >
      <Trophy className="w-6 h-6" />
      <span className="text-lg">Historical</span>
    </button>
  )}
  
</div>

        {/* Seasons List */}
        {seasons.length === 0 ? (
          <div className="bg-void-800 border border-void-700 rounded-lg p-12 text-center">
            <Calendar className="w-16 h-16 text-ink-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-ink-400 mb-2">No Seasons Yet</h2>
            <p className="text-ink-500">Create your first season to start tracking CWL stats</p>
          </div>
        ) : (
          <div className="bg-void-800 border border-void-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-signal-400" />
                Your Seasons
              </h2>
              <span className="text-sm text-ink-400">
                {seasons.length} season{seasons.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={pickedSeasonId}
                onChange={(e) => setPickedSeasonId(e.target.value)}
                className="flex-1 bg-void-950 border border-void-700 rounded-lg px-4 py-3 text-white"
              >
                {years.map((year) => (
                  <optgroup key={year} label={year}>
                    {seasonsByYear[year].map((season) => {
                      const total =
                        season.mainClan.length + season.secondaryClan.length;
                      return (
                        <option key={season.id} value={season.id}>
                          {season.name} — {total} player{total !== 1 ? "s" : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>

              <button
                onClick={() => {
                  const season = seasons.find((x) => x.id === pickedSeasonId);
                  if (season) onSelectSeason(season);
                }}
                disabled={!pickedSeasonId}
                className="bg-signal-600 hover:bg-signal-500 disabled:opacity-40 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                Open
              </button>

              {!isSharedMode && (
                <button
                  onClick={() => setDeleteConfirm(pickedSeasonId)}
                  disabled={!pickedSeasonId}
                  className="bg-void-800 hover:bg-void-700 border border-void-600 disabled:opacity-40 text-ink-400 hover:text-red-300 px-4 py-3 rounded-lg transition-colors"
                  aria-label="Delete season"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        {showModal && (
          <NewSeasonModal
            onCreateSeason={(name, year) => {
              onNewSeason(name, year);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        )}

        {showSettings && (
          <SettingsModal
            clanNames={clanNames}
            onSave={onUpdateClanNames}
            onClose={() => setShowSettings(false)}
          />
        )}

        {deleteConfirm && (
          <DeleteConfirmModal
            isAll={false}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteConfirm(null)}
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
    </div>
  );
};

export default SeasonSelector;
