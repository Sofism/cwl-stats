import React, { useState, useEffect } from "react";
import { X, Swords, ListChecks, BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { aggregateNormalWarStats, isEmptyWar } from "../utils/normalWarStats";

const parseApiDate = (raw) => {
  if (!raw) return null;
  const iso = raw.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5:$6"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/** Punto verde/rojo de war opt-in; sin dato (null/undefined) no pinta nada. */
const OptDot = ({ optedOut }) => {
  if (typeof optedOut !== "boolean") return null;
  return (
    <span
      title={optedOut ? "Opted out of war" : "Opted in to war"}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${optedOut ? "bg-bad-400" : "bg-ok-400"}`}
    />
  );
};

/** "Hace X" corto para el indicador de ultima sincronizacion. */
const timeAgo = (ms) => {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

const STALE_SYNC_MS = 3 * 60 * 60 * 1000;

/** Verde si el cron corrio hace poco; rojo si lleva horas sin hacerlo o fallo. */
const SyncStatus = ({ lastSync }) => {
  const stale = !lastSync || Date.now() - lastSync.at > STALE_SYNC_MS;
  const failed = lastSync?.status === "error";
  const bad = stale || failed;
  return (
    <p className={`text-xs mb-4 flex items-center gap-2 ${bad ? "text-bad-400" : "text-txt-low"}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${bad ? "bg-bad-400" : "bg-ok-400"}`} />
      {!lastSync
        ? "Sync has never run — wars are not being captured."
        : failed
        ? `Last sync failed ${timeAgo(lastSync.at)}: ${lastSync.error || "unknown error"}`
        : stale
        ? `Last sync ${timeAgo(lastSync.at)} — the cron may have stopped, wars may be missed.`
        : `Last sync ${timeAgo(lastSync.at)}`}
    </p>
  );
};

/** Tarjeta de un jugador en el log de ataques de una guerra concreta. */
const AttackLogCard = ({ player, hasDetail }) => (
  <div className="border border-line rounded-md p-4">
    <div className="flex items-center justify-between mb-3">
      <span className="font-semibold text-txt-hi flex items-center gap-2">
        <OptDot optedOut={player.optedOut} />
        {player.name}
      </span>
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

/** Barra fina + % grande + n/total; "—" si no hay muestra suficiente. */
const RateCell = ({ rate, num, den, tone }) => {
  if (rate == null) return <span className="text-txt-dim">—</span>;
  const bar = tone === "ok" ? "bg-ok-400" : "bg-accent-400";
  return (
    <div className="min-w-[96px]">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-lg font-semibold font-mono text-txt-hi">{Math.round(rate)}%</span>
        <span className="text-xs font-mono text-txt-dim">{num}/{den}</span>
      </div>
      <div className="h-1 mt-1 rounded-full bg-surface-700 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
    </div>
  );
};

/** Cabecera clicable que ordena por una columna. */
const SortTh = ({ label, sub, col, sort, onSort, className = "" }) => {
  const active = sort.key === col;
  const Icon = sort.dir === "desc" ? ChevronDown : ChevronUp;
  return (
    <th className={`p-3 ${className}`}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex flex-col items-center leading-tight ${
          active ? "text-accent-400" : "text-txt-low hover:text-txt-hi"
        }`}
      >
        <span className="inline-flex items-center gap-1 font-semibold">
          {label}
          {active && <Icon className="w-3.5 h-3.5" />}
        </span>
        {sub && <span className="text-[10px] font-normal text-txt-dim">{sub}</span>}
      </button>
    </th>
  );
};

/**
 * Tabla del clan: tres metricas que se leen de un vistazo (3★ rate, defense
 * rate, missed wars), cada una ordenable. Los jugadores sin muestra en la
 * columna ordenada van siempre al final, sea cual sea la direccion.
 */
const ClanStatsTable = ({ data, optByTag }) => {
  const [sort, setSort] = useState({ key: "threeRate", dir: "desc" });

  const onSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }
    );

  const sorted = data.slice().sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av !== bv) return sort.dir === "desc" ? bv - av : av - bv;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="border border-line rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-950 sticky top-0 z-10">
            <tr className="text-center">
              <th className="p-3 text-left sticky left-0 z-20 bg-surface-950 text-txt-low font-semibold">
                Player
              </th>
              <SortTh label="3★ rate" sub="fresh · same TH" col="threeRate" sort={sort} onSort={onSort} />
              <SortTh label="Defense rate" sub="held before 3★ · same TH" col="defenseRate" sort={sort} onSort={onSort} />
              <SortTh label="Missed wars" sub="no attacks used" col="missedWars" sort={sort} onSort={onSort} />
              <SortTh label="Wars" col="wars" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((p) => (
              <tr key={p.tag || p.name} className="hover:bg-surface-700/30 text-center">
                <td className="p-3 text-left sticky left-0 z-10 bg-surface-950 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 font-semibold text-txt-hi">
                    <OptDot optedOut={optByTag[p.tag]} />
                    {p.name}
                  </span>
                  <span className="ml-2 text-xs text-txt-dim">TH{p.th || "?"}</span>
                </td>
                <td className="p-3">
                  <RateCell rate={p.threeRate} num={p.sameThTriples} den={p.sameThAttacks} />
                </td>
                <td className="p-3">
                  <RateCell rate={p.defenseRate} num={p.sameThHeld} den={p.sameThDefenses} tone="ok" />
                </td>
                <td className="p-3 font-mono">
                  {p.detailedWars === 0 ? (
                    <span className="text-txt-dim">—</span>
                  ) : (
                    <span className={p.missedWars > 0 ? "text-bad-400 font-semibold" : "text-txt-low"}>
                      {p.missedWars}
                    </span>
                  )}
                </td>
                <td className="p-3 font-mono text-txt-low">{p.wars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
  const [liveWar, setLiveWar] = useState(null);
  const [activeTags, setActiveTags] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [statsDefense, setStatsDefense] = useState("all");
  const [statsOpt, setStatsOpt] = useState("all");
  const [statsRange, setStatsRange] = useState("all");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [selectedWarKey, setSelectedWarKey] = useState(null);
  const [defenseFilter, setDefenseFilter] = useState("all");

  useEffect(() => {
    if (!clanTag) return;
    let cancelled = false;
    setLoadingSaved(true);
    fetch(`/api/get-normal-wars?clanTag=${encodeURIComponent(clanTag)}`)
      .then((r) => (r.ok ? r.json() : { wars: [] }))
      .then((data) => {
        if (cancelled) return;
        const wars = (data.wars || [])
          .filter((w) => w.source !== "manual")
          .slice().sort((a, b) => (b.warKey || "").localeCompare(a.warKey || ""));
        setSavedWars(wars);
        // La guerra en curso solo se ofrece si aun no esta guardada.
        const live = data.live && !wars.some((w) => w.warKey === data.live.warKey) ? data.live : null;
        setLiveWar(live);
        setLastSync(data.lastSync || null);
        setActiveTags(Array.isArray(data.activeTags) ? data.activeTags : null);
        setSelectedWarKey((live || wars[0])?.warKey || null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clanTag]);

  const logWars = liveWar ? [liveWar, ...savedWars] : savedWars;
  const selectedWar = logWars.find((w) => w.warKey === selectedWarKey) || null;
  // Opt-in de la guerra mas reciente (en curso si la hay): es la foto que
  // congela el cron al empezar cada guerra, no el estado de este instante.
  const optByTag = {};
  ((liveWar || savedWars[0])?.us?.players || []).forEach((pl) => {
    optByTag[pl.tag] = pl.optedOut;
  });

  // Fuera del clan (mas de 12 h, calculado en el servidor) no aparecen en
  // stats; sus datos siguen guardados. Sin dato de roster no se oculta a nadie.
  // savedWars ya viene de mas reciente a mas antigua, asi que slice = ultimas N.
  const activeSet = activeTags ? new Set(activeTags) : null;
  const rangedWars = statsRange === "all" ? savedWars : savedWars.slice(0, Number(statsRange));
  const clanStats = aggregateNormalWarStats(rangedWars).filter((p) => {
    if (activeSet && !activeSet.has(p.tag)) return false;
    if (statsOpt === "in" && optByTag[p.tag] !== false) return false;
    if (statsOpt === "out" && optByTag[p.tag] !== true) return false;
    // Mismos contadores que la columna Defense rate (mismo TH, antes del
    // triple), para que filtro y tabla nunca se contradigan.
    if (statsDefense === "held" && p.sameThHeld === 0) return false;
    if (statsDefense === "triple" && p.sameThDefenses === p.sameThHeld) return false;
    if (statsDefense === "none" && p.sameThDefenses > 0) return false;
    return true;
  });

  const matchesDefense = (p) => {
    const defs = p.defenses || [];
    if (defenseFilter === "held") return defs.some((d) => d.stars < 3);
    if (defenseFilter === "triple") return defs.some((d) => d.stars === 3);
    if (defenseFilter === "none") return defs.length === 0;
    return true;
  };
  const visiblePlayers = (selectedWar?.us?.players || []).filter(matchesDefense);

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

        <SyncStatus lastSync={lastSync} />

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
            ) : logWars.length === 0 ? (
              <div className="border border-line rounded-md p-8 text-center text-txt-low text-sm">
                No regular wars saved yet for {clanLabel}. They get added automatically once the sync
                catches one (or paste one by hand in Settings).
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <select
                    value={selectedWarKey || ""}
                    onChange={(e) => setSelectedWarKey(e.target.value)}
                    className="w-full bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi text-sm"
                  >
                    {logWars.map((w) => (
                      <option key={w.warKey} value={w.warKey}>
                        {`${w === liveWar ? "LIVE · " : ""}${isEmptyWar(w) ? "(no data) " : w.recoveredFromFallback ? "(partial) " : ""}${w.startTime ? parseApiDate(w.startTime)?.toLocaleDateString() : w.warKey}${
                          w.them?.name ? ` vs ${w.them.name}` : ""
                        }`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={defenseFilter}
                    onChange={(e) => setDefenseFilter(e.target.value)}
                    className="sm:w-64 bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi text-sm"
                  >
                    <option value="all">Defense: all players</option>
                    <option value="held">Defense: held (not 3★)</option>
                    <option value="triple">Defense: 3-starred</option>
                    <option value="none">Defense: not attacked</option>
                  </select>
                </div>

                {selectedWar && selectedWar !== liveWar && (isEmptyWar(selectedWar) || selectedWar.recoveredFromFallback) && (
                  <div className="border border-line rounded-md p-3 mb-3 text-xs text-txt-low">
                    {isEmptyWar(selectedWar)
                      ? "This war has no recorded attacks (likely captured only during preparation). It is excluded from Clan stats."
                      : "This war was rescued from a snapshot taken before it ended, so some attacks may be missing. It doesn't count toward Missed wars."}
                  </div>
                )}
                {selectedWar && visiblePlayers.length === 0 && (
                  <div className="border border-line rounded-md p-6 text-center text-txt-low text-sm">
                    No players match this defense filter.
                  </div>
                )}
                {selectedWar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visiblePlayers.map((p) => (
                      <AttackLogCard key={p.tag || p.name} player={p} hasDetail />
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
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <select
                    value={statsRange}
                    onChange={(e) => setStatsRange(e.target.value)}
                    className="sm:w-56 bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi text-sm"
                  >
                    <option value="all">Wars: all</option>
                    <option value="5">Wars: last 5</option>
                    <option value="10">Wars: last 10</option>
                    <option value="20">Wars: last 20</option>
                  </select>
                  <select
                    value={statsOpt}
                    onChange={(e) => setStatsOpt(e.target.value)}
                    className="sm:w-56 bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi text-sm"
                  >
                    <option value="all">Opt-in: all players</option>
                    <option value="in">Opt-in: opted in</option>
                    <option value="out">Opt-in: opted out</option>
                  </select>
                  <select
                    value={statsDefense}
                    onChange={(e) => setStatsDefense(e.target.value)}
                    className="sm:w-64 bg-surface-800 border border-line rounded px-3 py-2 text-txt-hi text-sm"
                  >
                    <option value="all">Defense: all players</option>
                    <option value="held">Defense: rate above 0%</option>
                    <option value="triple">Defense: 3-starred by same TH</option>
                    <option value="none">Defense: no same-TH attacks</option>
                  </select>
                </div>
                <p className="text-xs text-txt-dim mb-3">
                  3★ rate = fresh attacks (first hit on a base) vs the same TH. Defense rate = hits from
                  the same TH that didn't 3-star the base, counted only until the base fell.
                  Click a header to sort. Dot = war opt-in as of the latest war:{" "}
                  <span className="text-ok-400">green</span> in, <span className="text-bad-400">red</span> out.
                  Players who left the clan more than 12 h ago are hidden.
                </p>
                <ClanStatsTable data={clanStats} optByTag={optByTag} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NormalWarsView;
