import React, { useState, useEffect, useCallback } from "react";
import { Swords, RefreshCw, X, Clock } from "lucide-react";
import { getCurrentCwlWar } from "../utils/cwlSync";
import ClanPerformanceTable from "./ClanPerformanceTable";
import ClanRosterModal from "./ClanRosterModal";

/**
 * La API devuelve las fechas como "20260829T120000.000Z", que Date no
 * entiende tal cual. Hay que insertar los separadores ISO.
 */
const parseApiDate = (raw) => {
  if (!raw) return null;
  const iso = raw.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5:$6"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const formatCountdown = (ms) => {
  if (ms <= 0) return "ended";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const StarRow = ({ stars }) => (
  <span className="text-amber-400 tracking-tight">
    {"★".repeat(stars)}
    <span className="text-txt-dim">{"★".repeat(3 - stars)}</span>
  </span>
);

const CurrentWarView = ({ clanTag, clanName, onClose }) => {
  const [war, setWar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  // "live" es la pestana que se abre por defecto.
  const [tab, setTab] = useState("live");
  const [rosterSort, setRosterSort] = useState("position"); // "position" | "pending"
  const [openClan, setOpenClan] = useState(null); // "us" | "them" | null

  const load = useCallback(() => {
    if (!clanTag) {
      setError("No clan tag configured. Add it in Settings.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getCurrentCwlWar(clanTag)
      .then((data) => {
        setWar(data);
        if (!data) setError("No CWL round is currently open for this clan.");
      })
      .catch((err) => setError(err.message || "Could not reach the clan API."))
      .finally(() => setLoading(false));
  }, [clanTag]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresco del contador cada minuto (no vuelve a llamar a la API).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const endDate = war ? parseApiDate(war.endTime) : null;
  const startDate = war ? parseApiDate(war.startTime) : null;
  const isPrep = war?.state === "preparation";
  const target = isPrep ? startDate : endDate;

  const winning =
    war &&
    (war.us.stars > war.them.stars ||
      (war.us.stars === war.them.stars && war.us.destruction > war.them.destruction));

  const liveRoster = war
    ? rosterSort === "pending" && !isPrep
      ? [...war.roster].sort(
          (a, b) =>
            Number(a.hasAttacked) - Number(b.hasAttacked) || a.position - b.position
        )
      : war.roster
    : [];

  const maxWars = (players) => players.reduce((m, p) => Math.max(m, p.wars || 0), 0);

  const tabClass = (id) =>
    `px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
      tab === id
        ? "border-accent-400 text-txt-hi"
        : "border-transparent text-txt-low hover:text-txt-hi"
    }`;

  return (
    <div className="fixed inset-0 bg-surface-950/95 z-50 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-txt-hi">
            <Swords className="w-6 h-6 text-accent-400" />
            Current War
          </h2>
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
 className="px-3 py-2 border border-line-strong rounded-md hover:border-accent-400 disabled:opacity-50 flex items-center gap-2 text-sm text-txt-hi"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
 className="px-3 py-2 bg-surface-700 rounded-md hover:bg-surface-700 text-txt-hi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-xs text-txt-low mb-4">
          Live view only — these numbers do not affect season stats until the
          round ends.
        </p>

        {war && (
          <div className="flex border-b border-line mb-6">
            <button onClick={() => setTab("live")} className={tabClass("live")}>
              Live
            </button>
            <button onClick={() => setTab("players")} className={tabClass("players")}>
              Players
            </button>
          </div>
        )}

        {loading && !war && (
          <div className="border border-line rounded-md p-8 text-center text-txt-low">
            Loading current round…
          </div>
        )}

        {error && !loading && (
          <div className="bg-amber-900/40 border border-amber-400/30 rounded-md p-4 text-yellow-200 text-sm">
            {error}
          </div>
        )}

        {war && (
          <>
            {tab === "live" && (
              <>
                {/* Marcador */}
                <div className="border border-line rounded-md p-6 mb-6">
                  <div className="flex items-center justify-between mb-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded ${
                        isPrep
                          ? "bg-surface-700 text-txt-mid"
                          : "bg-ok-900/50 text-ok-400"
                      }`}
                    >
                      {isPrep ? "Preparation" : "Battle day"} · {war.teamSize}v{war.teamSize}
                    </span>
                    {target && (
                      <span className="flex items-center gap-1 text-txt-low">
                        <Clock className="w-4 h-4" />
                        {isPrep ? "Starts in " : "Ends in "}
                        {formatCountdown(target.getTime() - now)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <div className="text-right">
                      <button
                        onClick={() => setOpenClan("us")}
                        className="font-semibold text-accent-300 truncate max-w-full hover:underline"
                        title="Open roster and performance"
                      >
                        {war.us.name || clanName}
                      </button>
                      <p className="text-3xl font-semibold text-txt-hi">{war.us.stars}★</p>
                      <p className="text-sm text-txt-low">
                        {war.us.destruction.toFixed(1)}% · {war.us.attacksUsed}/{war.teamSize} atk
                      </p>
                      {!isPrep && (
                        <p className="text-sm text-txt-mid">
                          <span className="font-mono">{war.usAttacksLeft}</span> attacks left
                        </p>
                      )}
                    </div>
                    <div className="text-center">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          winning
                            ? "bg-ok-900/50 text-ok-400"
                            : "bg-bad-900/50 text-bad-400"
                        }`}
                      >
                        {winning ? "Ahead" : "Behind"}
                      </span>
                    </div>
                    <div className="text-left">
                      <button
                        onClick={() => setOpenClan("them")}
                        className="font-semibold text-txt-mid truncate max-w-full hover:underline"
                        title="Open roster and performance"
                      >
                        {war.them.name}
                      </button>
                      <p className="text-3xl font-semibold text-txt-hi">{war.them.stars}★</p>
                      <p className="text-sm text-txt-low">
                        {war.them.destruction.toFixed(1)}% · {war.them.attacksUsed}/{war.teamSize} atk
                      </p>
                      {!isPrep && (
                        <p className="text-sm text-txt-mid">
                          <span className="font-mono">{war.themAttacksLeft}</span> attacks left
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Orden del roster */}
                <div className="flex items-center gap-2 mb-3 text-xs text-txt-low">
                  <span>Order</span>
                  {[
                    ["position", "Position"],
                    ["pending", "Pending first"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setRosterSort(id)}
                      disabled={id === "pending" && isPrep}
                      className={`px-2 py-1 rounded-md border disabled:opacity-40 ${
                        rosterSort === id
                          ? "border-accent-400 text-txt-hi"
                          : "border-line text-txt-low hover:border-line-strong"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Roster */}
                <div className="border border-line rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-950 text-txt-low">
                      <tr>
                        <th className="p-3 text-left">#</th>
                        <th className="p-3 text-left">Player</th>
                        <th className="p-3 text-center">TH</th>
                        <th className="p-3 text-left">Attack</th>
                        <th className="p-3 text-left">Defense taken</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {liveRoster.map((p) => (
                        <tr
                          key={p.tag}
                          className={p.hasAttacked ? "" : "bg-red-500/5"}
                        >
                          <td className="p-3 text-txt-low font-mono">{p.position}</td>
                          <td className="p-3 text-txt-hi">{p.name}</td>
                          <td className="p-3 text-center text-txt-low font-mono">{p.th || "—"}</td>
                          <td className="p-3">
                            {p.attacks.length === 0 ? (
                              <span className="text-bad-400 text-xs">
                                {isPrep ? "—" : "not used"}
                              </span>
                            ) : (
                              p.attacks.map((a, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <StarRow stars={a.stars} />
                                  <span className="text-txt-low text-xs">
                                    {a.destruction}%
                                    {a.defenderPosition ? ` → #${a.defenderPosition}` : ""}
                                  </span>
                                </div>
                              ))
                            )}
                          </td>
                          <td className="p-3">
                            {p.defense ? (
                              <div className="flex items-center gap-2">
                                <StarRow stars={p.defense.stars} />
                                <span className="text-txt-low text-xs">
                                  {p.defense.destruction}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-txt-dim text-xs">not attacked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "players" && (
              <>
                <p className="text-xs text-txt-low mb-3">
                  {war.us.name || clanName} · stats from {war.roundsCompleted} finished
                  round{war.roundsCompleted === 1 ? "" : "s"}. Click a header to sort, a row
                  to see its defences.
                </p>
                <ClanPerformanceTable players={war.usPlayers} state={war.state} />
              </>
            )}

            {openClan && (
              <ClanRosterModal
                title={openClan === "us" ? war.us.name || clanName : war.them.name}
                tag={openClan === "us" ? war.us.tag : war.them.tag}
                players={openClan === "us" ? war.usPlayers : war.themPlayers}
                state={war.state}
                attacksUsed={openClan === "us" ? war.us.attacksUsed : war.them.attacksUsed}
                attacksTotal={war.teamSize * war.attacksPerMember}
                roundsCompleted={maxWars(openClan === "us" ? war.usPlayers : war.themPlayers)}
                onClose={() => setOpenClan(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CurrentWarView;
