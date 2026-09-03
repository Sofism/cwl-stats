import React, { useState, useEffect, useCallback } from "react";
import { Swords, RefreshCw, X, Clock } from "lucide-react";
import { getCurrentCwlWar } from "../utils/cwlSync";
import CwlGroupPanel from "./CwlGroupPanel";

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

const CurrentWarView = ({ clanNames, initialClan = "main", onClose }) => {
  const [activeClan, setActiveClan] = useState(initialClan);
  const [war, setWar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Los dos clanes juegan CWL a la vez: se puede alternar sin cerrar la
  // vista, en vez de tener que reabrirla desde la pestaña del clan que
  // interese.
  const clanTag = activeClan === "main" ? clanNames?.mainTag : clanNames?.secondaryTag;
  const clanName = activeClan === "main" ? clanNames?.main : clanNames?.secondary;

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

  return (
    <div className="fixed inset-0 bg-surface-950/90 backdrop-blur-sm z-50 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
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

        <div className="flex gap-2 mb-4">
          {["main", "secondary"].map((key) => (
            <button
              key={key}
              onClick={() => setActiveClan(key)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                activeClan === key
                  ? "bg-accent-900 border-2 border-accent-400 text-txt-hi"
                  : "bg-surface-800 border-2 border-line hover:bg-surface-700 text-txt-mid"
              }`}
            >
              {key === "main" ? clanNames?.main || "Main" : clanNames?.secondary || "Secondary"}
            </button>
          ))}
        </div>

        <p className="text-xs text-txt-hi0 mb-4">
          Live view only — these numbers do not affect season stats until the
          round ends.
        </p>

        {loading && !war && (
          <div className="border border-line rounded-md p-8 text-center text-txt-low">
            Loading current round…
          </div>
        )}

        {error && !loading && (
          <div className="bg-amber-900 border border-amber-400/30 rounded-md p-4 text-yellow-200 text-sm">
            {error}
          </div>
        )}

        {war && (
          <>
            {/* Marcador */}
            <div className="border border-line rounded-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4 text-sm">
                <span
 className={`px-2 py-1 rounded ${
                    isPrep
                      ? "bg-surface-700 text-txt-mid"
                      : "bg-ok-900 text-ok-400"
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
                  <p className="font-semibold text-accent-300 truncate">
                    {war.us.name || clanName}
                  </p>
                  <p className="text-3xl font-semibold text-txt-hi">{war.us.stars}★</p>
                  <p className="text-sm text-txt-low">
                    {war.us.destruction.toFixed(1)}% · {war.us.attacksUsed}/{war.teamSize} atk
                  </p>
                </div>
                <div className="text-center">
                  <span
 className={`text-xs px-2 py-1 rounded ${
                      winning
                        ? "bg-ok-900 text-ok-400"
                        : "bg-bad-900 text-bad-400"
                    }`}
                  >
                    {winning ? "Ahead" : "Behind"}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-txt-mid truncate">{war.them.name}</p>
                  <p className="text-3xl font-semibold text-txt-hi">{war.them.stars}★</p>
                  <p className="text-sm text-txt-low">
                    {war.them.destruction.toFixed(1)}% · {war.them.attacksUsed}/{war.teamSize} atk
                  </p>
                </div>
              </div>
            </div>

            {/* Roster */}
            <div className="border border-line rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-950 text-txt-low sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left sticky left-0 z-20 bg-surface-950">Player</th>
                      <th className="p-3 text-center">TH</th>
                      <th className="p-3 text-left">Attack</th>
                      <th className="p-3 text-left">Defense taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {war.roster.map((p) => (
                      <tr
                        key={p.tag}
 className={p.hasAttacked ? "" : "bg-red-500/5"}
                      >
                        <td className="p-3 text-txt-hi0">{p.position}</td>
                        <td
 className={`p-3 text-txt-hi sticky left-0 z-10 ${
                            p.hasAttacked ? "bg-surface-950" : "bg-bad-900"
                          }`}
                        >
                          {p.name}
                        </td>
                        <td className="p-3 text-center text-txt-low">{p.th || "—"}</td>
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
            </div>

            <CwlGroupPanel clanTag={clanTag} />
          </>
        )}
      </div>
    </div>
  );
};

export default CurrentWarView;
