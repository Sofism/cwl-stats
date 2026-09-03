import React, { useState, useEffect } from "react";
import {
  Calendar, Plus, Play, Settings, Trash2, Swords, History,
  RefreshCw, UserPlus, UserMinus, ChevronRight, ShieldOff, ListChecks,
} from "lucide-react";
import NewSeasonModal from "./NewSeasonModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import SettingsModal from "./SettingsModal";
import HistoricalView from "./HistoricalView";
import CurrentWarView from "./CurrentWarView";
import NormalWarsView from "./NormalWarsView";
import {
  getHomeStatus,
  getCachedOptOuts,
  captureOptOutsForWar,
} from "../utils/homeStatus";

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
  <div className="font-mono text-[11px] tracking-[0.12em] text-txt-dim uppercase">
    {children}
  </div>
);

/** Panel de una guerra (CWL o normal). Misma forma para las dos. */
const WarPanel = ({ title, war, onOpen, optOuts, loadingOptOuts }) => {
  const [showPending, setShowPending] = useState(false);
  const isPrep = war.state === "preparation";
  const target = parseApiDate(isPrep ? war.startTime : war.endTime);
  const ahead =
    war.us.stars > war.them.stars ||
    (war.us.stars === war.them.stars && war.us.destruction > war.them.destruction);

  const Metric = ({ label, value, tone }) => (
    <div>
      <div className={`font-mono text-lg ${tone || "text-txt-hi"}`}>{value}</div>
      <div className="font-mono text-[10px] tracking-wider text-txt-dim uppercase mt-0.5">
        {label}
      </div>
    </div>
  );

  return (
    <div className="border border-line rounded-md p-5">
      <div className="flex items-center justify-between mb-4">
        <Label>{title}</Label>
        <span className="font-mono text-[11px] text-txt-dim">
          {isPrep ? "PREP" : "BATTLE"} · {war.teamSize}v{war.teamSize}
          {target ? ` · ${countdown(target)}` : ""}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="text-sm text-txt-low truncate">{war.us.name}</div>
          <div className="font-mono text-3xl text-txt-hi">{war.us.stars}</div>
          <div className="font-mono text-xs text-txt-dim">
            {war.us.destruction.toFixed(1)}%
          </div>
        </div>
        <div
          className={`font-mono text-[11px] px-3 ${
            ahead ? "text-ok-400" : "text-bad-400"
          }`}
        >
          {ahead ? "AHEAD" : "BEHIND"}
        </div>
        <div className="flex-1 text-right">
          <div className="text-sm text-txt-low truncate">{war.them.name}</div>
          <div className="font-mono text-3xl text-txt-hi">{war.them.stars}</div>
          <div className="font-mono text-xs text-txt-dim">
            {war.them.destruction.toFixed(1)}%
          </div>
        </div>
      </div>

      {!isPrep && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 py-4 border-t border-line">
          <Metric
            label="Our attacks"
            value={`${war.usAttacksUsed}/${war.usAttacksUsed + war.usAttacksLeft}`}
          />
          <Metric
            label="Enemy left"
            value={war.themAttacksLeft}
            tone={war.themAttacksLeft > 0 ? "text-rust-400" : "text-txt-hi"}
          />
          <Metric label="Untouched" value={war.ourBasesUntouched} />
          <Metric
            label="Held at 0★"
            value={war.perfectDefenses}
            tone={war.perfectDefenses > 0 ? "text-ok-400" : "text-txt-hi"}
          />
          <Metric label="Stars left" value={war.starsLeft} />
        </div>
      )}

      {war.pendingAttacks > 0 && !isPrep && (
        <div className="pt-3 border-t border-line">
          <button
            onClick={() => setShowPending(!showPending)}
            className="w-full flex items-center gap-2 text-left hover:text-accent-300 transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 text-accent-400 transition-transform ${
                showPending ? "rotate-90" : ""
              }`}
            />
            <span className="font-mono text-xs text-accent-400 tracking-wider">
              {war.pendingAttacks} ATTACK{war.pendingAttacks !== 1 ? "S" : ""} PENDING
            </span>
            <span className="font-mono text-[11px] text-txt-dim ml-auto">
              {war.pending.length} player{war.pending.length !== 1 ? "s" : ""}
            </span>
          </button>

          {showPending && (
            <div className="mt-3 space-y-1">
              {war.pending.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between text-sm border-b border-line/60 py-1.5"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-txt-dim w-6">
                      {p.position}
                    </span>
                    <span className="text-txt-mid">{p.name}</span>
                  </span>
                  <span className="font-mono text-xs text-rust-400">
                    {p.left} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(optOuts || loadingOptOuts) && (
        <div className="pt-3 mt-3 border-t border-line">
          <div className="flex items-center gap-2 mb-2">
            <ShieldOff className="w-3.5 h-3.5 text-txt-dim" />
            <span className="font-mono text-[11px] tracking-wider text-txt-dim uppercase">
              {loadingOptOuts
                ? "Checking war preferences…"
                : `Opted out at war start · ${optOuts.players.length} of ${optOuts.total}`}
            </span>
          </div>
          {optOuts && optOuts.players.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {optOuts.players.map((p) => (
                <span
                  key={p.tag}
                  className="text-sm text-txt-low bg-surface-800 border border-line rounded px-2 py-0.5"
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}
          {optOuts && optOuts.players.length === 0 && (
            <p className="text-sm text-txt-dim">Everyone had war turned on.</p>
          )}
        </div>
      )}

      {onOpen && (
        <button
          onClick={onOpen}
          className="mt-4 w-full border border-line-strong hover:border-accent-400 hover:text-accent-400 text-txt-mid rounded px-3 py-2.5 text-sm transition-colors"
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
  const [showNormalWars, setShowNormalWars] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pickedSeasonId, setPickedSeasonId] = useState(seasons[0]?.id || "");

  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [optOuts, setOptOuts] = useState(null);
  const [loadingOptOuts, setLoadingOptOuts] = useState(false);

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

  // La lista de "war opted out" se congela por guerra: si ya hay foto de
  // esta guerra se reutiliza; si es una guerra nueva se calcula una vez.
  // Va en segundo plano para no bloquear la carga del home.
  const warKey = status?.regularWar?.warKey;
  useEffect(() => {
    if (!warKey || !clanNames?.mainTag) {
      setOptOuts(null);
      return;
    }
    const cached = getCachedOptOuts(warKey);
    if (cached) {
      setOptOuts(cached);
      return;
    }
    setLoadingOptOuts(true);
    captureOptOutsForWar(clanNames.mainTag, warKey)
      .then(setOptOuts)
      .finally(() => setLoadingOptOuts(false));
  }, [warKey, clanNames?.mainTag]);

  const handleDeleteConfirm = () => {
    if (deleteConfirm) onDeleteSeason(deleteConfirm);
    setDeleteConfirm(null);
  };

  const hasAnyWar = status && (status.cwl || status.regularWar);

  return (
    <div className="min-h-screen bg-surface-950 text-txt-mid p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-line mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-txt-hi">CWL Stats Tracker</h1>
            <div className="font-mono text-xs tracking-[0.1em] text-txt-dim uppercase mt-1">
              {clanNames?.main || "Main"} · {clanNames?.secondary || "Secondary"}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadStatus}
              disabled={loadingStatus}
              className="border border-line-strong rounded px-3 py-2 text-sm text-txt-low hover:text-txt-hi transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingStatus ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="border border-line-strong rounded px-3 py-2 text-sm text-txt-low hover:text-txt-hi transition-colors flex items-center gap-2"
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
              <WarPanel
                title="Clan war"
                war={status.regularWar}
                optOuts={optOuts}
                loadingOptOuts={loadingOptOuts}
              />
            )}
            {!hasAnyWar && (
              <div className="border border-line rounded-md p-6 text-center">
                <Label>No war in progress</Label>
                <p className="text-sm text-txt-dim mt-2">
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
                <span key={p.tag} className="text-sm text-ok-400 border border-ok-400/30 bg-ok-900 rounded px-2 py-0.5 flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />{p.name}
                </span>
              ))}
              {status.roster.left.map((p) => (
                <span key={p.tag} className="text-sm text-bad-400 border border-bad-400/30 bg-bad-900 rounded px-2 py-0.5 flex items-center gap-1">
                  <UserMinus className="w-3 h-3" />{p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accesos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => setShowCurrentWar(true)}
            className="border border-line hover:border-line-strong rounded-md p-4 text-left transition-colors"
          >
            <Swords className="w-4 h-4 text-txt-low mb-2" />
            <div className="text-base text-txt-hi">Live war</div>
            <div className="font-mono text-xs text-txt-dim mt-1">CWL ROUND DETAIL</div>
          </button>
          <button
            onClick={() => setShowNormalWars(true)}
            className="border border-line hover:border-line-strong rounded-md p-4 text-left transition-colors"
          >
            <ListChecks className="w-4 h-4 text-txt-low mb-2" />
            <div className="text-base text-txt-hi">Normal wars</div>
            <div className="font-mono text-xs text-txt-dim mt-1">HISTORY & ATTACK LOG</div>
          </button>
          <button
            onClick={() => setShowHistorical(true)}
            className="border border-line hover:border-line-strong rounded-md p-4 text-left transition-colors"
          >
            <History className="w-4 h-4 text-txt-low mb-2" />
            <div className="text-base text-txt-hi">Historical</div>
            <div className="font-mono text-xs text-txt-dim mt-1">
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
              className="text-sm text-txt-low hover:text-accent-400 flex items-center gap-1 transition-colors"
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
            clanNames={clanNames}
            onClose={() => setShowCurrentWar(false)}
          />
        )}
        {showNormalWars && (
          <NormalWarsView
            clanNames={clanNames}
            onClose={() => setShowNormalWars(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SeasonSelector;
