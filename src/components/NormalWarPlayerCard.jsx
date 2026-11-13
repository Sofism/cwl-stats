import React from "react";
import { Stars } from "./NormalWarTimeline";
import { warClock } from "../utils/normalWarLog";

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(
    raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")
  );
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const Kpi = ({ label, value, sub, tone }) => (
  <div className="border border-line rounded-md p-3 text-center">
    <div className={`font-mono text-xl font-semibold ${tone || "text-txt-hi"}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wide text-txt-dim mt-1">{label}</div>
    {sub && <div className="text-[10px] font-mono text-txt-dim">{sub}</div>}
  </div>
);

const pct = (rate) => (rate == null ? "—" : `${Math.round(rate)}%`);

/**
 * Ficha de un jugador: sus numeros acumulados en TODAS las guerras
 * guardadas (los mismos que Clan stats) y, guerra a guerra, que ataco y que
 * defensas recibio, con las defensas en el orden en que llegaron.
 *
 * @param {object} stats   fila de aggregateNormalWarStats para este jugador
 * @param {Array}  history playerHistory(...) de este jugador
 */
const NormalWarPlayerCard = ({ stats, history, optedOut, selectedWarKey, onSelectWar, onClear, noDataWars = [] }) => {
  // Guerras con datos y guerras oficiales "sin datos" juntas, por fecha de fin.
  const rows = [
    ...history.map((h) => ({ type: "data", h, endTime: h.war.endTime || h.war.warKey })),
    ...noDataWars.map((w) => ({ type: "nodata", w, endTime: w.endTime })),
  ].sort((a, b) => String(b.endTime).localeCompare(String(a.endTime)));
  const attacksMade = history.reduce((n, h) => n + h.attacks.length, 0);
  const stars = history.reduce((n, h) => n + h.attacks.reduce((s, a) => s + a.stars, 0), 0);
  const triples = history.reduce((n, h) => n + h.attacks.filter((a) => a.stars === 3).length, 0);
  const defenses = history.reduce((n, h) => n + h.defenses.length, 0);

  return (
    <div className="border border-accent-400 rounded-md p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {typeof optedOut === "boolean" && (
            <span
              title={optedOut ? "Opted out of war" : "Opted in to war"}
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${optedOut ? "bg-bad-400" : "bg-ok-400"}`}
            />
          )}
          <h3 className="text-lg font-semibold text-txt-hi truncate">{stats?.name || history[0]?.player.name}</h3>
          <span className="text-xs text-txt-dim">TH{stats?.th || history[0]?.player.th || "?"}</span>
        </div>
        <button onClick={onClear} className="text-xs text-txt-low hover:text-txt-hi border border-line rounded px-2 py-1">
          Clear
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <Kpi label="Wars" value={stats?.wars ?? history.length} />
        <Kpi
          label="Missed wars"
          value={stats && stats.detailedWars > 0 ? stats.missedWars : "—"}
          tone={stats && stats.missedWars > 0 ? "text-bad-400" : undefined}
        />
        <Kpi
          label="3★ rate"
          value={pct(stats?.threeRate)}
          sub={stats ? `${stats.sameThTriples}/${stats.sameThAttacks} fresh · same TH` : undefined}
        />
        <Kpi
          label="Defense rate"
          value={pct(stats?.defenseRate)}
          sub={stats ? `${stats.sameThHeld}/${stats.sameThDefenses} same TH` : undefined}
          tone="text-ok-400"
        />
        <Kpi label="Attacks" value={attacksMade} sub={`${triples} × 3★ · ${stars}★`} />
        <Kpi label="Defenses faced" value={defenses} />
      </div>

      <div className="text-xs uppercase tracking-wide text-txt-dim mb-2">All saved wars</div>
      <div className="border border-line rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-950 text-txt-low">
              <tr className="text-left">
                <th className="p-2">War</th>
                <th className="p-2">Attacks</th>
                <th className="p-2">Defenses (in order of arrival)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                if (row.type === "nodata") {
                  return (
                    <tr
                      key={row.w.warKey}
                      onClick={() => onSelectWar(row.w.warKey)}
                      className={`cursor-pointer hover:bg-surface-700/30 ${
                        row.w.warKey === selectedWarKey ? "bg-accent-900/20" : ""
                      }`}
                    >
                      <td className="p-2 whitespace-nowrap align-top">
                        <div className="text-txt-dim">{fmtDate(row.w.endTime)}</div>
                        <div className="text-[10px] text-txt-dim truncate max-w-[9rem]">
                          {row.w.them?.name ? `vs ${row.w.them.name}` : ""}
                        </div>
                      </td>
                      <td className="p-2 align-top text-txt-dim text-xs" colSpan={2}>
                        no player data for this war
                      </td>
                    </tr>
                  );
                }
                const h = row.h;
                // Tras el primer triple la base ya habia caido: esos golpes
                // se pintan apagados, no cuentan como defensa.
                const firstTriple = h.defenses.findIndex((d) => d.stars === 3);
                return (
                  <tr
                    key={h.war.warKey}
                    onClick={() => onSelectWar(h.war.warKey)}
                    className={`cursor-pointer hover:bg-surface-700/30 ${
                      h.war.warKey === selectedWarKey ? "bg-accent-900/20" : ""
                    }`}
                  >
                    <td className="p-2 whitespace-nowrap align-top">
                      <div className="text-txt-mid">{fmtDate(h.war.startTime)}</div>
                      <div className="text-[10px] text-txt-dim truncate max-w-[9rem]">
                        {h.war.them?.name ? `vs ${h.war.them.name}` : ""}
                        {h.war.recoveredFromFallback ? " · partial" : ""}
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      {h.attacks.length === 0 ? (
                        <span className={h.war.recoveredFromFallback ? "text-txt-dim" : "text-bad-400"}>
                          {h.war.recoveredFromFallback ? "no data" : "missed"}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {h.attacks.map((a, i) => (
                            <span key={i} className="whitespace-nowrap text-xs">
                              <Stars n={a.stars} />
                              <span className="ml-1.5 font-mono text-txt-low">{a.destruction}%</span>
                              <span className="ml-1.5 text-txt-dim" title={warClock(a.seenAt, h.war)?.title}>
                                vs TH{a.opponentTh ?? "?"} · {a.fresh ? "clean" : "cleanup"}
                                {warClock(a.seenAt, h.war) ? ` · ${warClock(a.seenAt, h.war).left}` : ""}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-2 align-top">
                      {h.defenses.length === 0 ? (
                        <span className="text-ok-400 text-xs">not attacked</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {h.defenses.map((d, i) => (
                            <span
                              key={i}
                              title={`${d.stars}★ ${d.destruction}% from TH${d.attackerTh ?? "?"}${
                                d.order != null ? ` (attack #${d.order})` : ""
                              }`}
                              className={`inline-flex items-center gap-1 text-xs border rounded px-1.5 py-0.5 ${
                                i === firstTriple
                                  ? "border-bad-400 text-bad-400"
                                  : firstTriple !== -1 && i > firstTriple
                                  ? "border-line text-txt-dim"
                                  : "border-ok-400 text-ok-400"
                              }`}
                            >
                              {d.stars}★
                              <span className="text-[10px] opacity-70">TH{d.attackerTh ?? "?"}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-txt-dim mt-2">
        Defenses: green = the base held, red = the hit that finally 3-starred it, grey = hits after it had already
        fallen. Click a row to open that war in the log.
      </p>
    </div>
  );
};

export default NormalWarPlayerCard;
