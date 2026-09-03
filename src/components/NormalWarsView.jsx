import React, { useState, useEffect, useCallback } from "react";
import { X, Swords, History, ListChecks, BarChart3, Flame } from "lucide-react";
import { getWarLog, getCurrentStreak } from "../utils/cocApi";
import { getHomeStatus } from "../utils/homeStatus";
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

const ClanBadge = ({ badge }) =>
  badge ? (
    <img src={badge} alt="" className="w-8 h-8 flex-shrink-0" />
  ) : (
    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-surface-700" />
  );

const ResultPill = ({ result }) => {
  const map = {
    win: ["Win", "bg-ok-900 text-ok-400"],
    loss: ["Loss", "bg-bad-900 text-bad-400"],
    tie: ["Draw", "bg-surface-700 text-txt-mid"],
  };
  const [label, cls] = map[result] || ["?", "bg-surface-700 text-txt-dim"];
  return <span className={`text-xs px-2 py-1 rounded font-semibold ${cls}`}>{label}</span>;
};

const StreakBadge = ({ streak }) => {
  if (!streak) return null;
  const isWin = streak.result === "win";
  const isTie = streak.result === "tie";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-semibold ${
        isTie ? "bg-surface-700 text-txt-mid" : isWin ? "bg-ok-900 text-ok-400" : "bg-bad-900 text-bad-400"
      }`}
    >
      <Flame className="w-3 h-3" />
      {isTie ? "Last was a draw" : `${streak.count} ${isWin ? "win" : "loss"}${streak.count !== 1 ? "es" : ""} streak`}
    </span>
  );
};

/** Una fila del listado de guerras (warlog de un clan cualquiera). */
const WarLogRow = ({ war }) => {
  const date = parseApiDate(war.endTime);
  return (
    <div className="flex items-center gap-3 border-t border-line py-2.5 text-sm">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <ClanBadge badge={war.clan?.badgeUrls?.small} />
        <span className="text-txt-hi truncate">{war.clan?.name}</span>
      </div>
      <div className="text-txt-mid font-mono text-xs w-16 text-center">
        {war.clan?.stars}★ <span className="text-txt-dim">{Math.round(war.clan?.destructionPercentage || 0)}%</span>
      </div>
      <ResultPill result={war.result} />
      <div className="text-txt-mid font-mono text-xs w-16 text-center">
        {war.opponent?.stars}★ <span className="text-txt-dim">{Math.round(war.opponent?.destructionPercentage || 0)}%</span>
      </div>
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
        <span className="text-txt-hi truncate text-right">{war.opponent?.name}</span>
        <ClanBadge badge={war.opponent?.badgeUrls?.small} />
      </div>
      <div className="text-txt-dim text-xs w-16 text-right hidden sm:block">
        {date ? date.toLocaleDateString() : "—"}
      </div>
    </div>
  );
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

/** Tarjeta de un jugador en la vista acumulada del clan. */
const ClanStatCard = ({ p }) => (
  <div className="border border-line rounded-md p-4">
    <div className="flex items-center justify-between mb-3">
      <span className="font-semibold text-txt-hi">{p.name}</span>
      <span className="text-xs text-txt-dim">TH{p.th} · {p.wars} wars</span>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-accent-400 uppercase tracking-wide mb-1">Offense</div>
        <p className="font-mono text-lg text-txt-hi">{p.successRate.toFixed(1)}%</p>
        <p className="text-xs text-txt-dim">3★ rate ({p.offAttacksCounted} counted)</p>
      </div>
      <div>
        <div className="text-xs text-bad-400 uppercase tracking-wide mb-1">Defense</div>
        <p className="font-mono text-lg text-txt-hi">{p.defenseFailRate.toFixed(1)}%</p>
        <p className="text-xs text-txt-dim">3★ conceded ({p.defAttacksCounted} counted)</p>
      </div>
    </div>
    <div className="flex justify-between text-xs text-txt-low mt-3 pt-3 border-t border-line">
      <span>Missed atk: <span className={p.missAtk > 0 ? "text-bad-400" : "text-ok-400"}>{p.missAtk}</span></span>
      <span>Net ★: <span className={p.netStars >= 0 ? "text-ok-400" : "text-bad-400"}>{p.netStars >= 0 ? "+" : ""}{p.netStars}</span></span>
    </div>
  </div>
);

const NormalWarsView = ({ clanNames, initialClan = "main", onClose }) => {
  const [activeClan, setActiveClan] = useState(initialClan);
  const [tab, setTab] = useState("overview");

  const clanTag = activeClan === "main" ? clanNames?.mainTag : clanNames?.secondaryTag;
  const clanLabel = activeClan === "main" ? clanNames?.main || "Main" : clanNames?.secondary || "Secondary";

  // --- Overview: guerra actual + listados + racha ---
  const [status, setStatus] = useState(null);
  const [ourLog, setOurLog] = useState([]);
  const [opponentLog, setOpponentLog] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadOverview = useCallback(async () => {
    if (!clanTag) {
      setLoadingOverview(false);
      return;
    }
    setLoadingOverview(true);
    const [homeStatus, log] = await Promise.all([getHomeStatus(clanTag), getWarLog(clanTag)]);
    setStatus(homeStatus);
    setOurLog(log);

    const opponentTag = homeStatus?.regularWar?.them?.tag;
    if (opponentTag) {
      setOpponentLog(await getWarLog(opponentTag));
    } else {
      setOpponentLog([]);
    }
    setLoadingOverview(false);
  }, [clanTag]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // --- Saved wars (cron + manual), para Attack log y Clan stats ---
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
    <div className="fixed inset-0 bg-surface-950/90 backdrop-blur-sm z-50 overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-txt-hi">
            <Swords className="w-6 h-6 text-accent-400" />
            Normal Wars
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-surface-700 rounded-md hover:bg-surface-700 text-txt-hi self-start sm:self-auto"
          >
            <X className="w-4 h-4" />
          </button>
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

        <div className="flex gap-2 mb-6">
          {[
            { key: "overview", label: "Overview", icon: History },
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

        {tab === "overview" && (
          <>
            {loadingOverview ? (
              <div className="text-center text-txt-low text-sm py-6">Loading…</div>
            ) : (
              <>
                {status?.regularWar ? (
                  <div className="border border-line rounded-md p-6 mb-6">
                    <div className="flex items-center justify-between mb-4 text-sm">
                      <span className="px-2 py-1 rounded bg-surface-700 text-txt-mid">
                        {status.regularWar.state} · {status.regularWar.teamSize}v{status.regularWar.teamSize}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-accent-300 truncate">{status.regularWar.us.name}</p>
                        <p className="text-3xl font-semibold text-txt-hi">{status.regularWar.us.stars}★</p>
                        <p className="text-sm text-txt-low">{status.regularWar.us.destruction.toFixed(1)}%</p>
                      </div>
                      <div className="text-center text-xs text-txt-dim">vs</div>
                      <div className="text-left">
                        <p className="font-semibold text-txt-mid truncate">{status.regularWar.them.name}</p>
                        <p className="text-3xl font-semibold text-txt-hi">{status.regularWar.them.stars}★</p>
                        <p className="text-sm text-txt-low">{status.regularWar.them.destruction.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-line rounded-md p-6 mb-6 text-center text-txt-low text-sm">
                    No active regular war right now for {clanLabel}.
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-line rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-txt-hi">{clanLabel} — last wars</h3>
                      <StreakBadge streak={getCurrentStreak(ourLog)} />
                    </div>
                    {ourLog.length === 0 ? (
                      <p className="text-sm text-txt-dim py-4 text-center">No war log available (private or empty).</p>
                    ) : (
                      ourLog.map((w, i) => <WarLogRow key={i} war={w} />)
                    )}
                  </div>

                  <div className="border border-line rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-txt-hi">Opponent — last wars</h3>
                      <StreakBadge streak={getCurrentStreak(opponentLog)} />
                    </div>
                    {!status?.regularWar ? (
                      <p className="text-sm text-txt-dim py-4 text-center">No active war — no opponent to show.</p>
                    ) : opponentLog.length === 0 ? (
                      <p className="text-sm text-txt-dim py-4 text-center">Opponent's war log is private or empty.</p>
                    ) : (
                      opponentLog.map((w, i) => <WarLogRow key={i} war={w} />)
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

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
                      {w.date || (w.startTime ? parseApiDate(w.startTime)?.toLocaleDateString() : w.warKey)}
                      {w.them?.name ? ` vs ${w.them.name}` : w.opponentName ? ` vs ${w.opponentName}` : ""}
                      {w.source === "manual" ? " (manual)" : ""}
                    </option>
                  ))}
                </select>

                {selectedWar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(selectedWar.us?.players || []).map((p) => (
                      <AttackLogCard key={p.tag} player={p} hasDetail={selectedWar.source !== "manual"} />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clanStats.map((p) => (
                    <ClanStatCard key={p.tag} p={p} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NormalWarsView;
