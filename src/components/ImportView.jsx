import React, { useState } from "react";
import { Trophy, Users, AlertCircle, Calendar, Plus, ArrowLeft } from "lucide-react";
import SeasonList from "./SeasonList";
import LeagueSettings from "./LeagueSettings";
import NewSeasonModal from "./NewSeasonModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { parseData } from "../utils/dataParser";

const ImportView = ({
  seasons,
  currentSeason,
  setCurrentSeason,
  addSeason,
  deleteSeason,
  deleteAllSeasons,
  updateSeasonData,
  saveStatus,
  onClose,
  onBackToSelector,
  getSeasonsByYear,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState(
    currentSeason?.leagueInfo || {
      main: { league: "Crystal I", position: 1, warsWon: 0 },
      secondary: { league: "Crystal I", position: 1, warsWon: 0 },
    }
  );

  const handleImport = (text, isMain) => {
    if (!text.trim() || !currentSeason) return;
    const key = isMain ? "mainClan" : "secondaryClan";
    const parsedData = parseData(text, isMain ? "Main" : "Secondary");
    const updated = {
      ...currentSeason,
      [key]: parsedData,
      leagueInfo: leagueInfo,
    };
    updateSeasonData(updated);
  };

  const updateLeague = (newInfo) => {
    setLeagueInfo(newInfo);
    if (!currentSeason) return;
    const updated = { ...currentSeason, leagueInfo: newInfo };
    updateSeasonData(updated);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm === "ALL") {
      deleteAllSeasons();
    } else {
      deleteSeason(deleteConfirm);
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        {seasons.length > 0 && (
          <button
            onClick={onBackToSelector}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Seasons
          </button>
        )}
        
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            CWL Stats Tracker
          </h1>
        </div>

        {saveStatus && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500 text-green-300">
            {saveStatus}
          </div>
        )}

        {seasons.length > 0 && (
          <SeasonList
            seasons={seasons}
            onSelectSeason={(s) => {
              setCurrentSeason(s);
              if (s.leagueInfo) setLeagueInfo(s.leagueInfo);
            }}
            onDeleteSeason={(id) => setDeleteConfirm(id)}
            onNewSeason={() => setShowModal(true)}
            getSeasonsByYear={getSeasonsByYear}
          />
        )}

        {!currentSeason ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
            <Calendar className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">No Season Selected</h2>
            <button
              onClick={() => setShowModal(true)}
              className="bg-purple-500 text-white font-bold py-3 px-6 rounded-lg inline-flex items-center gap-2 hover:bg-purple-600"
            >
              <Plus className="w-5 h-5" />
              Create New Season
            </button>
          </div>
        ) : (
          <>
            <LeagueSettings
              leagueInfo={leagueInfo}
              updateLeague={updateLeague}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-purple-400" />
                  True North
                </h2>
                <textarea
                  className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono text-white"
                  placeholder="Paste spreadsheet data here..."
                  onChange={(e) => handleImport(e.target.value, true)}
                />
                {currentSeason.mainClan.length > 0 && (
                  <div className="mt-3 text-green-400 text-sm">
                    ✓ {currentSeason.mainClan.length} players loaded
                  </div>
                )}
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-400" />
                  DD
                </h2>
                <textarea
                  className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono text-white"
                  placeholder="Paste spreadsheet data here..."
                  onChange={(e) => handleImport(e.target.value, false)}
                />
                {currentSeason.secondaryClan.length > 0 && (
                  <div className="mt-3 text-green-400 text-sm">
                    ✓ {currentSeason.secondaryClan.length} players loaded
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-blue-400 inline mr-2" />
              <span className="text-sm text-blue-200">
                Copy data from Excel/Google Sheets and paste here. Data saves automatically!
              </span>
            </div>

            {(currentSeason.mainClan.length > 0 || currentSeason.secondaryClan.length > 0) && (
              <button
                onClick={onClose}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 rounded-lg transition-colors"
              >
                View Dashboard →
              </button>
            )}
          </>
        )}

        {deleteConfirm && (
          <DeleteConfirmModal
            isAll={deleteConfirm === "ALL"}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}

        {showModal && (
          <NewSeasonModal
            onCreateSeason={(name, year) => {
              addSeason(name, year);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ImportView;
