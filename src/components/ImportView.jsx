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
  updateClanNames,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showManualImport, setShowManualImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessages, setSyncMessages] = useState([]);
  const [syncProgress, setSyncProgress] = useState(null);
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
    if (!mainResult) messages.push(`⚠ ${clanNames.main}: not currently in CWL (or the clan tag / proxy failed).`);
    if (!secondaryResult) messages.push(`⚠ ${clanNames.secondary}: not currently in CWL (or the clan tag / proxy failed).`);

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

    if (mainResult) messages.push(`✓ ${mainResult.clanName || clanNames.main}: ${mainResult.players.length} players synced.`);
    if (secondaryResult) messages.push(`✓ ${secondaryResult.clanName || clanNames.secondary}: ${secondaryResult.players.length} players synced.`);

    // Nombres reales de los clanes desde la API: si difieren de los
    // guardados a mano, se actualizan solos.
    const apiNames = {};
    if (mainResult?.clanName) apiNames.main = mainResult.clanName;
    if (secondaryResult?.clanName) apiNames.secondary = secondaryResult.clanName;
    if (Object.keys(apiNames).length && updateClanNames) {
      updateClanNames({ ...clanNames, ...apiNames });
    }

    // Progreso de la liga: rondas jugadas / totales, para saber si lo que
    // se ve es definitivo o todavia esta en marcha.
    const ref = mainResult || secondaryResult;
    setSyncProgress(
      ref
        ? {
            season: ref.season,
            roundsCompleted: ref.roundsCompleted,
            roundsTotal: ref.roundsTotal,
            live: ref.liveRounds > 0,
            isComplete: ref.isComplete,
          }
        : null
    );

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
    <div className="min-h-screen bg-surface-950 text-txt-mid p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        {seasons.length > 0 && (
          <button
            onClick={onBackToSelector}
 className="mb-4 flex items-center gap-2 text-txt-low hover:text-txt-hi transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Seasons
          </button>
        )}
        
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-4xl font-semibold tracking-wide text-txt-hi">
            CWL Stats Tracker
          </h1>
        </div>

        {saveStatus && (
          <div className="mb-4 p-3 rounded-md bg-ok-900/50 border border-ok-400/40 text-ok-400">
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
          <div className="border border-line rounded-md p-8 text-center">
            <Calendar className="w-16 h-16 text-accent-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-4">No Season Selected</h2>
            <button
              onClick={() => setShowModal(true)}
 className="bg-signal-500 text-txt-hi font-semibold py-3 px-6 rounded-md inline-flex items-center gap-2 hover:bg-accent-900"
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
            <div className="border border-line rounded-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <RefreshCw className={`w-6 h-6 text-accent-400 ${syncing ? "animate-spin" : ""}`} />
                Sync from Clash of Clans
              </h2>

              {!hasTags ? (
                <div className="bg-amber-900/40 border border-amber-400/30 rounded-md p-4 text-sm text-yellow-200">
                  Add both clan tags in Settings (⚙) to enable automatic syncing.
                </div>
              ) : (
                <>
                  <p className="text-txt-low text-sm mb-4">
                    Pulls league, final position, wars won and every player’s stats straight from
                    the game API. No more pasting data by hand.
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
 className="w-full border border-accent-400 text-accent-400 hover:bg-accent-900 disabled:opacity-50 text-txt-hi font-semibold py-3 rounded-md transition-all  flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync now"}
                  </button>
                  {syncProgress && (
                    <div className="mt-3 p-3 rounded border border-accent-400/30 bg-accent-900/40 text-sm">
                      <p className="text-accent-300 font-semibold">
                        {syncProgress.season ? `Season ${syncProgress.season} — ` : ""}
                        Round {syncProgress.roundsCompleted}
                        {syncProgress.roundsTotal ? ` of ${syncProgress.roundsTotal}` : ""}
                        {syncProgress.live ? " · next round in progress" : ""}
                      </p>
                      <p className="text-txt-low text-xs mt-1">
                        {syncProgress.live
                          ? "The ongoing round is not counted yet. Sync again once it ends."
                          : !syncProgress.isComplete
                          ? "Sync again after each war to keep stats up to date."
                          : "All rounds finished — these stats are final."}
                      </p>
                    </div>
                  )}
                  {syncMessages.length > 0 && (
                    <div className="mt-3 space-y-1 text-sm">
                      {syncMessages.map((m, i) => (
                        <p key={i} className="text-txt-mid">{m}</p>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="mt-4">
                <button
                  onClick={() => setShowManualImport(!showManualImport)}
 className="text-xs text-txt-hi0 hover:text-txt-mid flex items-center gap-1"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showManualImport ? "rotate-180" : ""}`} />
                  {showManualImport ? "Hide manual import" : "Paste data manually (fallback)"}
                </button>
              </div>
            </div>

            {showManualImport && (
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="border border-line rounded-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-accent-400" />
                    {clanNames.main}
                  </h2>
                  <textarea
 className="w-full h-64 bg-surface-950 border border-line rounded p-3 text-sm font-mono text-txt-hi"
                    placeholder="Paste spreadsheet data here..."
                    onChange={(e) => handleImport(e.target.value, true)}
                  />
                  {currentSeason.mainClan.length > 0 && (
                    <div className="mt-3 text-ok-400 text-sm">
                      ✓ {currentSeason.mainClan.length} players loaded
                    </div>
                  )}
                </div>

                <div className="border border-line rounded-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-6 h-6 text-txt-low" />
                    {clanNames.secondary}
                  </h2>
                  <textarea
 className="w-full h-64 bg-surface-950 border border-line rounded p-3 text-sm font-mono text-txt-hi"
                    placeholder="Paste spreadsheet data here..."
                    onChange={(e) => handleImport(e.target.value, false)}
                  />
                  {currentSeason.secondaryClan.length > 0 && (
                    <div className="mt-3 text-ok-400 text-sm">
                      ✓ {currentSeason.secondaryClan.length} players loaded
                    </div>
                  )}
                </div>
              </div>
            )}

            {!hasTags && (
              <div className="bg-accent-900/40 border border-accent-400/30 rounded-md p-4 mb-6">
                <AlertCircle className="w-5 h-5 text-accent-400 inline mr-2" />
                <span className="text-sm text-accent-300">
                  Copy data from Excel/Google Sheets and paste here. Data saves automatically!
                </span>
              </div>
            )}

            {(currentSeason.mainClan.length > 0 || currentSeason.secondaryClan.length > 0) && (
              <button
                onClick={onClose}
 className="w-full border border-accent-400 text-accent-400 hover:bg-accent-900 text-txt-hi font-semibold py-4 rounded-md transition-all "
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
