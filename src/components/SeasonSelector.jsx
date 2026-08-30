import React, { useState, useEffect } from "react";
import {
  Calendar, Plus, Play, Settings, Trash2, Swords, History,
  RefreshCw, UserPlus, UserMinus, AlertTriangle,
} from "lucide-react";
import NewSeasonModal from "./NewSeasonModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import SettingsModal from "./SettingsModal";
import HistoricalView from "./HistoricalView";
import CurrentWarView from "./CurrentWarView";
import { getHomeStatus } from "../utils/homeStatus";

const parseApiDate = (raw) => {
  if (!raw) return null;
  const iso = raw.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5:$6"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const countdown = (date) => {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "ended";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const Label = ({ children }) => (
  <div className="font-mono text-[10px] tracking-[0.12em] text-txt-dim uppercase">
    {children}
  </div>
);

/** Panel de una guerra (CWL o normal). Misma forma para las dos. */
const WarPanel = ({ title, war, onOpen }) => {
  const isPrep = war.state === "preparation";
  const target = parseApiDate(isPrep ? war.startTime : war.endTime);
  const ahead =
    war.us.stars > war.them.stars ||
    (war.us.stars === war.them.stars && war.us.destruction > war.them.destruction);

  return (
    <div className="border border-line rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <Label>{title}</Label>
        <span className="font-mono text-[10px] text-txt-dim">
          {isPrep ? "PREP" : "BATTLE"} · {war.teamSize}v{war.teamSize}
          {target ? ` · ${countdown(target)}` : ""}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs text-txt-low truncate">{war.us.name}</div>
          <div className="font-mono text-2xl text-txt-hi">{war.us.stars}</div>
          <div className="font-mono text-[10px] text-txt-dim">
            {war.us.destruction.toFixed(1)}%
          </div>
        </div>
        <div
          className={`font-mono text-[10px] px-2 ${
            ahead ? "text-ok-400" : "text-bad-400"
          }`}
        >
          {ahead ? "AHEAD" : "BEHIND"}
        </div>
        <div className="flex-1 text-right">
          <div className="text-xs text-txt-low truncate">{war.them.name}</div>
          <div className="font-mono text-2xl text-txt-hi">{war.them.stars}</div>
          <div className="font-mono text-[10px] text-txt-dim">
            {war.them.destruction.toFixed(1)}%
          </div>
        </div>
      </div>

      {war.pendingAttacks > 0 && war.state !== "preparation" && (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3 h-3 text-accent-400" />
            <span className="font-mono text-[10px] text-accent-400 tracking-wider">
              {war.pendingAttacks} ATTACK{war.pendingAttacks !== 1 ? "S" : ""} PENDING
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {war.pending.slice(0, 10).map((p) => (
              <span
                key={p.name}
                className="text-[11px] text-txt-mid bg-surface-800 border border-line rounded px-2 py-0.5"
              >
                {p.name}
                {p.left > 1 ? ` ×${p.left}` : ""}
              </span>
            ))}
            {war.pending.length > 10 && (
              <span className="text-[11px] text-txt-dim px-1">
                +{war.pending.length - 10}
              </span>
            )}
          </div>
        </div>
      )}

      {onOpen && (
        <button
          onClick={onOpen}
          className="mt-3 w-full border border-line-strong hover:border-accent-400 hover:text-accent-400 text-txt-mid rounded px-3 py-2 text-xs transition-colors"
        >
          Open live view
        </button>
      )}
    </div>
  );
};

const SeasonSelector = ({
  seasons,
  onSelectSeason,
  onNewSeason,
  onDeleteSeason,
  getSeasonsByYear,
  isSharedMode,
  clanNames,
  onUpdateClanNames,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showCurrentWar, setShowCurrentWar] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pickedSeasonId, setPickedSeasonId] = useState(seasons[0]?.id || "");

  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const seasonsByYear = getSeasonsByYear();
  const years = Object.keys(seasonsByYear).sort((a, b) => b - a);

  const loadStatus = React.useCallback(() => {
    if (!clanNames?.mainTag) return;
    setLoadingStatus(true);
    getHomeStatus(clanNames.mainTag)
      .then(setStatus)
      .finally(() => setLoadingStatus(false));
  }, [clanNames?.mainTag]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleDeleteConfirm = () => {
    if (deleteConfirm) onDeleteSeason(deleteConfirm);
    setDeleteConfirm(null);
  };

  const hasAnyWar = status && (status.cwl || status.regularWar);

  return (
    <div className="min-h-screen bg-surface-950 text-txt-mid p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Cabecera */}
        <div className="flex items-start justify-between pb-4 border-b border-line mb-6">
          <div>
            <h1 className="text-lg font-semibold text-txt-hi">CWL Stats Tracker</h1>
            <div className="font-mono text-[10px] tracking-[0.1em] text-txt-dim uppercase mt-1">
              {clanNames?.main || "Main"} · {clanNames?.secondary || "Secondary"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStatus}
              disabled={loadingStatus}
              className="border border-line-strong rounded px-3 py-2 text-xs text-txt-low hover:text-txt-hi transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingStatus ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="border border-line-strong rounded px-3 py-2 text-xs text-txt-low hover:text-txt-hi transition-colors flex items-center gap-2"
            >
              <Settings className="w-3 h-3" />
              Settings
            </button>
          </div>
        </div>

        {/* Estado en vivo */}
        {!clanNames?.mainTag ? (
          <div className="border border-line rounded-md p-6 mb-6 text-center">
            <p className="text-sm text-txt-low">
              Add your clan tags in Settings to see live war status.
            </p>
          </div>
        ) : loadingStatus && !status ? (
          <div className="border border-line rounded-md p-6 mb-6">
            <Label>Loading status…</Label>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {status?.cwl && (
              <WarPanel
                title="CWL · Current round"
                war={status.cwl}
                onOpen={() => setShowCurrentWar(true)}
              />
            )}
            {status?.regularWar && (
              <WarPanel title="Clan war" war={status.regularWar} />
            )}
            {!hasAnyWar && (
              <div className="border border-line rounded-md p-6 text-center">
                <Label>No war in progress</Label>
                <p className="text-xs text-txt-dim mt-2">
                  Nothing running right now. Clan war status needs a public war log.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Altas y bajas */}
        {status?.roster && (status.roster.joined.length > 0 || status.roster.left.length > 0) && (
          <div className="border border-line rounded-md p-4 mb-6">
            <Label>Roster changes</Label>
            <div className="flex flex-wrap gap-2 mt-3">
              {status.roster.joined.map((p) => (
                <span key={p.tag} className="text-[11px] text-ok-400 border border-ok-400/30 bg-ok-900/40 rounded px-2 py-0.5 flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />{p.name}
                </span>
              ))}
              {status.roster.left.map((p) => (
                <span key={p.tag} className="text-[11px] text-bad-400 border border-bad-400/30 bg-bad-900/40 rounded px-2 py-0.5 flex items-center gap-1">
                  <UserMinus className="w-3 h-3" />{p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accesos */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setShowCurrentWar(true)}
            className="border border-line hover:border-line-strong rounded-md p-4 text-left transition-colors"
          >
            <Swords className="w-4 h-4 text-txt-low mb-2" />
            <div className="text-sm text-txt-hi">Live war</div>
            <div className="font-mono text-[10px] text-txt-dim mt-1">CWL ROUND DETAIL</div>
          </button>
          <button
            onClick={() => setShowHistorical(true)}
            className="border border-line hover:border-line-strong rounded-md p-4 text-left transition-colors"
          >
            <History className="w-4 h-4 text-txt-low mb-2" />
            <div className="text-sm text-txt-hi">Historical</div>
            <div className="font-mono text-[10px] text-txt-dim mt-1">
              {seasons.length} SEASON{seasons.length !== 1 ? "S" : ""}
            </div>
          </button>
        </div>

        {/* Temporadas */}
        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between mb-3">
            <Label>Seasons</Label>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-txt-low hover:text-accent-400 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> New season
            </button>
          </div>

          {seasons.length === 0 ? (
            <div className="border border-line rounded-md p-6 text-center">
              <Calendar className="w-6 h-6 text-txt-dim mx-auto mb-2" />
              <p className="text-sm text-txt-low">No seasons yet.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={pickedSeasonId}
                onChange={(e) => setPickedSeasonId(e.target.value)}
                className="flex-1 bg-surface-900 border border-line rounded px-3 py-2 text-sm text-txt-mid"
              >
                {years.map((year) => (
                  <optgroup key={year} label={year}>
                    {seasonsByYear[year].map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.mainClan.length + s.secondaryClan.length} players
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={() => {
                  const s = seasons.find((x) => x.id === pickedSeasonId);
                  if (s) onSelectSeason(s);
                }}
                disabled={!pickedSeasonId}
                className="border border-accent-400 text-accent-400 hover:bg-accent-900 rounded px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 transition-colors"
              >
                <Play className="w-3 h-3" /> Open
              </button>
              {!isSharedMode && (
                <button
                  onClick={() => setDeleteConfirm(pickedSeasonId)}
                  disabled={!pickedSeasonId}
                  className="border border-line-strong text-txt-dim hover:text-bad-400 rounded px-3 py-2 disabled:opacity-40 transition-colors"
                  aria-label="Delete season"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {showModal && (
          <NewSeasonModal
            onCreateSeason={(name, year) => { onNewSeason(name, year); setShowModal(false); }}
            onCancel={() => setShowModal(false)}
          />
        )}
        {deleteConfirm && (
          <DeleteConfirmModal
            isAll={false}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
        {showSettings && (
          <SettingsModal
            clanNames={clanNames}
            onSave={onUpdateClanNames}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showHistorical && (
          <HistoricalView
            seasons={seasons}
            clanNames={clanNames}
            onClose={() => setShowHistorical(false)}
          />
        )}
        {showCurrentWar && (
          <CurrentWarView
            clanTag={clanNames?.mainTag}
            clanName={clanNames?.main}
            onClose={() => setShowCurrentWar(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SeasonSelector;
