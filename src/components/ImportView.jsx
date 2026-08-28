import React, { useState } from "react";
import {
  Trophy,
  Users,
  AlertCircle,
  Calendar,
  Plus,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import SeasonList from "./SeasonList";
import LeagueSettings from "./LeagueSettings";
import NewSeasonModal from "./NewSeasonModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { parseData } from "../utils/dataParser";
import { syncCwlData } from "../utils/cwlSync";

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
  clanNames,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showManualImport, setShowManualImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessages, setSyncMessages] = useState([]);
  const [leagueInfo, setLeagueInfo] = useState(
    currentSeason?.leagueInfo || {
      main: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
      secondary: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
    }
  );

  const hasTags = Boolean(clanNames.mainTag && clanNames.secondaryTag);

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

  const handleSync = async () => {
    if (!currentSeason || !hasTags) return;
    setSyncing(true);
    setSyncMessages([]);

    const results = await Promise.all([
      syncCwlData(clanNames.mainTag, "Main"),
      syncCwlData(clanNames.secondaryTag, "Secondary"),
    ]);
    const [mainResult, secondaryResult] = results;

    const messages = [];
    if (!mainResult) messages.push(`⚠ ${clanNames.main}: no está en CWL ahora mismo (o el tag/proxy falló).`);
    if (!secondaryResult) messages.push(`⚠ ${clanNames.secondary}: no está en CWL ahora mismo (o el tag/proxy falló).`);

    const newLeagueInfo = {
      main: mainResult
        ? {
            league: mainResult.league || leagueInfo.main.league,
            position: mainResult.position || leagueInfo.main.position,
            warsWon: mainResult.warsWon,
            warSize: mainResult.warSize,
          }
        : leagueInfo.main,
      secondary: secondaryResult
        ? {
            league: secondaryResult.league || leagueInfo.secondary.league,
            position: secondaryResult.position || leagueInfo.secondary.position,
            warsWon: secondaryResult.warsWon,
            warSize: secondaryResult.warSize,
          }
        : leagueInfo.secondary,
    };

    const updated = {
      ...currentSeason,
      mainClan: mainResult ? mainResult.players : currentSeason.mainClan,
      secondaryClan: secondaryResult ? secondaryResult.players : currentSeason.secondaryClan,
      leagueInfo: newLeagueInfo,
    };

    setLeagueInfo(newLeagueInfo);
    updateSeasonData(updated);

    if (mainResult) messages.push(`✓ ${clanNames.main}: ${mainResult.players.length} jugadores sincronizados.`);
    if (secondaryResult) messages.push(`✓ ${clanNames.secondary}: ${secondaryResult.players.length} jugadores sincronizados.`);
    setSyncMessages(messages);
    setSyncing(false);
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
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-signal-900 to-void-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        {seasons.length > 0 && (
          <button
            onClick={onBackToSelector}
            className="mb-4 flex items-center gap-2 text-ink-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Seasons
          </button>
        )}
        
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl font-display font-bold tracking-wide bg-gradient-to-r from-signal-400 to-steel-300 bg-clip-text text-transparent">
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
          <div className="bg-void-800 border border-void-700 rounded-lg p-8 text-center">
            <Calendar className="w-16 h-16 text-signal-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">No Season Selected</h2>
            <button
              onClick={() => setShowModal(true)}
              className="bg-signal-500 text-white font-bold py-3 px-6 rounded-lg inline-flex items-center gap-2 hover:bg-signal-600"
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
              clanNames={clanNames}
            />

            {/* Sincronización automática desde la API del juego */}
            <div className="bg-void-800 border border-void-700 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <RefreshCw className={`w-6 h-6 text-signal-400 ${syncing ? "animate-spin" : ""}`} />
                Sync from Clash of Clans
              </h2>

              {!hasTags ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-200">
                  Añade los tags de ambos clanes en Ajustes (⚙) para poder sincronizar automáticamente.
                </div>
              ) : (
                <>
                  <p className="text-ink-400 text-sm mb-4">
                    Trae la liga, la posición, las guerras ganadas y las stats de cada jugador
                    directamente de la API del juego. Ya no hace falta pegar nada a mano.
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full bg-signal-500 hover:bg-signal-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Sincronizando..." : "Sincronizar ahora"}
                  </button>
                  {syncMessages.length > 0 && (
                    <div className="mt-3 space-y-1 text-sm">
                      {syncMessages.map((m, i) => (
                        <p key={i} className="text-ink-200">{m}</p>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="mt-4">
                <button
                  onClick={() => setShowManualImport(!showManualImport)}
                  className="text-xs text-ink-500 hover:text-ink-200 flex items-center gap-1"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showManualImport ? "rotate-180" : ""}`} />
                  {showManualImport ? "Ocultar" : "Pegar datos manualmente (respaldo)"}
                </button>
              </div>
            </div>

            {showManualImport && (
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-void-800 border border-void-700 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-signal-400" />
                    {clanNames.main}
                  </h2>
                  <textarea
                    className="w-full h-64 bg-void-950 border border-void-700 rounded p-3 text-sm font-mono text-white"
                    placeholder="Paste spreadsheet data here..."
                    onChange={(e) => handleImport(e.target.value, true)}
                  />
                  {currentSeason.mainClan.length > 0 && (
                    <div className="mt-3 text-green-400 text-sm">
                      ✓ {currentSeason.mainClan.length} players loaded
                    </div>
                  )}
                </div>

                <div className="bg-void-800 border border-void-700 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Users className="w-6 h-6 text-steel-400" />
                    {clanNames.secondary}
                  </h2>
                  <textarea
                    className="w-full h-64 bg-void-950 border border-void-700 rounded p-3 text-sm font-mono text-white"
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
            )}

            {!hasTags && (
              <div className="bg-signal-500/10 border border-signal-500/30 rounded-lg p-4 mb-6">
                <AlertCircle className="w-5 h-5 text-signal-400 inline mr-2" />
                <span className="text-sm text-signal-200">
                  Copy data from Excel/Google Sheets and paste here. Data saves automatically!
                </span>
              </div>
            )}

            {(currentSeason.mainClan.length > 0 || currentSeason.secondaryClan.length > 0) && (
              <button
                onClick={onClose}
                className="w-full bg-signal-500 hover:bg-signal-600 text-white font-bold py-4 rounded-lg transition-colors"
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
