import React, { useState, useEffect } from "react";
import { X, Swords, ListChecks, BarChart3 } from "lucide-react";
import { aggregateNormalWarStats } from "../utils/normalWarStats";

const parseApiDate = (raw) => {
  if (!raw) return null;
  const iso = raw.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5:$6"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/** Tarjeta de un jugador en el log de ataques de una guerra concreta. */
const AttackLogCard = ({ player, hasDetail }) => (
  <div className="border border-line rounded-md p-4">
    <div className="flex items-center justify-between mb-3">
      <span className="font-semibold text-txt-hi">{player.name}</span>
      <span className="text-xs text-txt-dim">TH{player.th}</span>
    </div>

    {hasDetail ? (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-accent-400 uppercase tracking-wide mb-1">Offense</div>
          {(player.attacks || []).length === 0 ? (
            <p className="text-xs text-bad-400">No attacks used</p>
          ) : (
            player.attacks.map((a, i) => (
              <div key={i} className="text-xs text-txt-mid flex justify-between">
                <span>{a.stars}★ {a.destruction}%{a.fresh ? "" : " (cleanup)"}</span>
                <span className="text-txt-dim">vs TH{a.opponentTh ?? "?"}</span>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="text-xs text-bad-400 uppercase tracking-wide mb-1">Defense</div>
          {(player.defenses || []).length === 0 ? (
            <p className="text-xs text-ok-400">Not attacked</p>
          ) : (
            player.defenses.map((d, i) => (
              <div key={i} className="text-xs text-txt-mid flex justify-between">
                <span>{d.stars}★ {d.destruction}%{d.fresh ? "" : " (cleanup)"}</span>
                <span className="text-txt-dim">from TH{d.attackerTh ?? "?"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-accent-400 uppercase tracking-wide mb-1">Offense</div>
          <p className="text-txt-mid">{player.offStars}★ · {player.offDest?.toFixed(1)}%</p>
        </div>
        <div>
          <div className="text-bad-400 uppercase tracking-wide mb-1">Defense</div>
          <p className="text-txt-mid">{player.defStars}★ · {player.defDest?.toFixed(1)}%</p>
        </div>
      </div>
    )}
  </div>
);

/** % de un conteo sobre un total, o "—" si el total es 0 (nada que dividir). */
const pct = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "—");

/**
 * Tabla acumulada del clan, estilo denso (misma idea que StatsTable de
 * CWL): jugador fijo a la izquierda, bloque de ofensa y bloque de defensa
 * separados por un borde, cada estrella con su conteo y %.
 */
const ClanStatsTable = ({ data }) => (
  <div className="border border-line rounded-md overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-950 text-txt-low sticky top-0 z-10">
          <tr className="text-center">
            <th className="p-3 text-left sticky left-0 z-20 bg-surface-950">Player</th>
            <th className="p-3">TH</th>
            <th className="p-3">Wars</th>
            <th className="p-3 border-l border-line-strong text-accent-400">Atk</th>
            <th className="p-3 text-accent-400">3★</th>
            <th className="p-3 text-accent-400">2★</th>
            <th className="p-3 text-accent-400">1★</th>
            <th className="p-3 text-accent-400">0★</th>
            <th className="p-3 border-l border-line-strong text-bad-400">Def</th>
            <th className="p-3 text-bad-400">3★</th>
            <th className="p-3 text-bad-400">2★</th>
            <th className="p-3 text-bad-400">1★</th>
            <th className="p-3 text-bad-400">0★</th>
            <th className="p-3 border-l border-line-strong">Missed</th>
            <th className="p-3">Net ★</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((p) => (
            <tr key={p.tag || p.name} className="hover:bg-surface-700/30 text-center">
              <td className="p-3 text-left font-semibold text-txt-hi sticky left-0 z-10 bg-surface-950">
                {p.name}
              </td>
              <td className="p-3 text-txt-low">{p.th || "—"}</td>
              <td className="p-3 text-txt-low">{p.wars}</td>
              <td className="p-3 border-l border-line font-mono">{p.offAttacksCounted}</td>
              <td className="p-3 font-mono">
                {p.offStars3} <span className="text-txt-dim text-xs">({pct(p.offStars3, p.offAttacksCounted)})</span>
              </td>
              <td className="p-3 font-mono">
                {p.offStars2} <span className="text-txt-dim text-xs">({pct(p.offStars2, p.offAttacksCounted)})</span>
              </td>
              <td className="p-3 font-mono">
                {p.offStars1} <span className="text-txt-dim text-xs">({pct(p.offStars1, p.offAttacksCounted)})</span>
              </td>
              <td className="p-3 font-mono">
                {p.offStars0} <span className="text-txt-dim text-xs">({pct(p.offStars0, p.offAttacksCounted)})</span>
              </td>
              <td className="p-3 border-l border-line font-mono">{p.defAttacksCounted}</td>
              <td className="p-3 font-mono">
                {p.defStars3} <span className="text-txt-dim text-xs">({pct(p.defStars3, p.defAttacksCounted)})</span>
              </td>
              <td className="p-3 font-mono">
                {p.defStars2} <span className="text-txt-dim text-xs">({pct(p.defStars2, p.defAttacksCounted)})</span>
              </td>
              <td className="p-3 font-mono">
                {p.defStars1} <span className="text-txt-dim text-xs">({pct(p.defStars1, p.defAttacksCounted)})</span>
              </td>
              <td className="p-3 font-mono">
                {p.defStars0} <span className="text-txt-dim text-xs">({pct(p.defStars0, p.defAttacksCounted)})</span>
              </td>
              <td className="p-3 border-l border-line font-mono">
                <span className={p.missAtk > 0 ? "text-bad-400" : "text-ok-400"}>{p.missAtk}</span>
              </td>
              <td className="p-3 font-mono">
                <span className={p.netStars >= 0 ? "text-ok-400" : "text-bad-400"}>
                  {p.netStars >= 0 ? "+" : ""}
                  {p.netStars}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/**
 * Log de ataques y estadisticas acumuladas de guerras normales. Solo del
 * clan principal: el secundario juega exclusivamente CWL, nunca tiene
 * guerras normales que mostrar aqui.
 */
const NormalWarsView = ({ clanNames, onClose }) => {
  const [tab, setTab] = useState("attacks");
  const clanTag = clanNames?.mainTag;
  const clanLabel = clanNames?.main || "Main";

  const [savedWars, setSavedWars] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [selectedWarKey, setSelectedWarKey] = useState(null);
  const [attackThFilter, setAttackThFilter] = useState("upOrEqual");
  const [defenseThFilter, setDefenseThFilter] = useState("downOrEqual");

  useEffect(() => {
    if (!clanTag) return;
    let cancelled = false;
    setLoadingSaved(true);
    fetch(`/api/get-normal-wars?clanTag=${encodeURIComponent(clanTag)}`)
      .then((r) => (r.ok ? r.json() : { wars: [] }))
      .then((data) => {
        if (cancelled) return;
        const wars = (data.wars || []).slice().sort((a, b) => (b.warKey || "").localeCompare(a.warKey || ""));
        setSavedWars(wars);
        setSelectedWarKey(wars[0]?.warKey || null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clanTag]);

  const selectedWar = savedWars.find((w) => w.warKey === selectedWarKey) || null;
  const clanStats = aggregateNormalWarStats(savedWars, { attackThFilter, defenseThFilter });

  return (
    <div className="fixed inset-0 bg-surface-950 z-50 overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-txt-hi">
            <Swords className="w-6 h-6 text-accent-400" />
            Normal Wars — {clanLabel}
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-surface-700 rounded-md hover:bg-surface-700 text-txt-hi self-start sm:self-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { key: "attacks", label: "Attack log", icon: ListChecks },
            { key: "stats", label: "Clan stats", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
                tab === key
                  ? "border border-accent-400 text-accent-400"
                  : "border border-line text-txt-low hover:border-line-strong"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "attacks" && (
          <div>
            {loadingSaved ? (
              <div className="text-center text-txt-low text-sm py-6">Loading…</div>
            ) : savedWars.length === 0 ? (
              <div className="border border-line rounded-md p-8 text-center text-txt-low text-sm">
                No regular wars saved yet for {clanLabel}. They get added automatically once the sync
                catches one (or paste one by hand in Settings).
              </div>
            ) : (
              <>
                <select
                  value={selectedWarKey || ""}
                  onChange={(e) => setSelectedWarKey(e.target.value)}
                  className="w-full mb-4 bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi text-sm"
                >
                  {savedWars.map((w) => (
                    <option key={w.warKey} value={w.warKey}>
                      {w.source === "manual"
                        ? `Manual batch (as of ${w.asOfDate})`
                        : `${w.startTime ? parseApiDate(w.startTime)?.toLocaleDateString() : w.warKey}${
                            w.them?.name ? ` vs ${w.them.name}` : ""
                          }`}
                    </option>
                  ))}
                </select>

                {selectedWar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(selectedWar.us?.players || []).map((p) => (
                      <AttackLogCard key={p.tag || p.name} player={p} hasDetail={selectedWar.source !== "manual"} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div>
            {loadingSaved ? (
              <div className="text-center text-txt-low text-sm py-6">Loading…</div>
            ) : savedWars.length === 0 ? (
              <div className="border border-line rounded-md p-8 text-center text-txt-low text-sm">
                No regular wars saved yet for {clanLabel} — nothing to aggregate.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 mb-4 text-sm">
                  <label className="flex items-center gap-2">
                    <span className="text-txt-low">Offense vs TH:</span>
                    <select
                      value={attackThFilter}
                      onChange={(e) => setAttackThFilter(e.target.value)}
                      className="bg-surface-800 border border-line rounded px-2 py-1 text-txt-hi"
                    >
                      <option value="upOrEqual">Equal or higher</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-txt-low">Defense vs TH:</span>
                    <select
                      value={defenseThFilter}
                      onChange={(e) => setDefenseThFilter(e.target.value)}
                      className="bg-surface-800 border border-line rounded px-2 py-1 text-txt-hi"
                    >
                      <option value="downOrEqual">Equal or lower attacker</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                </div>

                <ClanStatsTable data={clanStats} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NormalWarsView;
