import React, { useState, useEffect, useCallback } from "react";
import { Swords, RefreshCw, X, Clock } from "lucide-react";
import { getCurrentCwlWar } from "../utils/cwlSync";

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
  <span className="text-yellow-400 tracking-tight">
    {"★".repeat(stars)}
    <span className="text-ink-600">{"★".repeat(3 - stars)}</span>
  </span>
);

const CurrentWarView = ({ clanTag, clanName, onClose }) => {
  const [war, setWar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

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
    <div className="fixed inset-0 bg-void-950/95 z-50 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2 text-white">
            <Swords className="w-6 h-6 text-signal-400" />
            Current War
          </h2>
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-2 bg-signal-700 border border-signal-500 rounded-lg hover:bg-signal-600 disabled:opacity-50 flex items-center gap-2 text-sm text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-void-700 rounded-lg hover:bg-void-600 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-xs text-ink-500 mb-4">
          Live view only — these numbers do not affect season stats until the
          round ends.
        </p>

        {loading && !war && (
          <div className="bg-void-800 border border-void-700 rounded-lg p-8 text-center text-ink-400">
            Loading current round…
          </div>
        )}

        {error && !loading && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-200 text-sm">
            {error}
          </div>
        )}

        {war && (
          <>
            {/* Marcador */}
            <div className="bg-void-800 border border-void-700 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4 text-sm">
                <span
                  className={`px-2 py-1 rounded ${
                    isPrep
                      ? "bg-steel-500/20 text-steel-200"
                      : "bg-green-500/20 text-green-300"
                  }`}
                >
                  {isPrep ? "Preparation" : "Battle day"} · {war.teamSize}v{war.teamSize}
                </span>
                {target && (
                  <span className="flex items-center gap-1 text-ink-400">
                    <Clock className="w-4 h-4" />
                    {isPrep ? "Starts in " : "Ends in "}
                    {formatCountdown(target.getTime() - now)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-signal-300 truncate">
                    {war.us.name || clanName}
                  </p>
                  <p className="text-3xl font-bold text-white">{war.us.stars}★</p>
                  <p className="text-sm text-ink-400">
                    {war.us.destruction.toFixed(1)}% · {war.us.attacksUsed}/{war.teamSize} atk
                  </p>
                </div>
                <div className="text-center">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      winning
                        ? "bg-green-500/20 text-green-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {winning ? "Ahead" : "Behind"}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-ink-200 truncate">{war.them.name}</p>
                  <p className="text-3xl font-bold text-white">{war.them.stars}★</p>
                  <p className="text-sm text-ink-400">
                    {war.them.destruction.toFixed(1)}% · {war.them.attacksUsed}/{war.teamSize} atk
                  </p>
                </div>
              </div>
            </div>

            {/* Roster */}
            <div className="bg-void-800 border border-void-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-void-950 text-ink-400">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Player</th>
                    <th className="p-3 text-center">TH</th>
                    <th className="p-3 text-left">Attack</th>
                    <th className="p-3 text-left">Defense taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-void-700">
                  {war.roster.map((p) => (
                    <tr
                      key={p.tag}
                      className={p.hasAttacked ? "" : "bg-red-500/5"}
                    >
                      <td className="p-3 text-ink-500">{p.position}</td>
                      <td className="p-3 text-white">{p.name}</td>
                      <td className="p-3 text-center text-ink-400">{p.th || "—"}</td>
                      <td className="p-3">
                        {p.attacks.length === 0 ? (
                          <span className="text-red-300 text-xs">
                            {isPrep ? "—" : "not used"}
                          </span>
                        ) : (
                          p.attacks.map((a, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <StarRow stars={a.stars} />
                              <span className="text-ink-400 text-xs">
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
                            <span className="text-ink-400 text-xs">
                              {p.defense.destruction}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-600 text-xs">not attacked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CurrentWarView;
