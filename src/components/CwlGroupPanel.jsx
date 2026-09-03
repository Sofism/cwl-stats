import React, { useEffect, useState } from "react";
import { Trophy, Swords } from "lucide-react";
import { getCwlGroupOverview } from "../utils/cwlSync";

const ClanBadge = ({ badge, name }) =>
  badge ? (
    <img src={badge} alt="" className="w-8 h-8 flex-shrink-0" />
  ) : (
    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-surface-700" />
  );

/** Tarjeta de un clan en la clasificacion del grupo (8 en total). */
const StandingCard = ({ clan, isUs }) => (
  <div
    className={`border rounded-md p-4 ${
      isUs ? "border-accent-400 bg-accent-900/20" : "border-line"
    }`}
  >
    <div className="flex items-center gap-3 mb-3">
      <span className="font-mono text-lg text-txt-dim w-5 text-right">{clan.rank}</span>
      <ClanBadge badge={clan.badge} name={clan.name} />
      <span className="font-semibold text-txt-hi truncate">{clan.name}</span>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div>
        <div className="font-mono text-base text-ok-400">{clan.wins}</div>
        <div className="text-txt-dim uppercase tracking-wide">Wins</div>
      </div>
      <div>
        <div className="font-mono text-base text-bad-400">{clan.losses}</div>
        <div className="text-txt-dim uppercase tracking-wide">Losses</div>
      </div>
      <div>
        <div className="font-mono text-base text-txt-mid">{clan.draws}</div>
        <div className="text-txt-dim uppercase tracking-wide">Draws</div>
      </div>
    </div>
    <div className="flex justify-between text-xs text-txt-low mt-3 pt-3 border-t border-line">
      <span>{clan.stars}★</span>
      <span>{clan.destruction.toFixed(1)}%</span>
    </div>
  </div>
);

/** Un emparejamiento de una ronda (dos clanes cualesquiera del grupo). */
const MatchCard = ({ match, ourTag }) => {
  const involvesUs = match.clanA.tag === ourTag || match.clanB.tag === ourTag;
  return (
    <div
      className={`border rounded-md p-3 ${
        involvesUs ? "border-accent-400 bg-accent-900/20" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ClanBadge badge={match.clanA.badge} name={match.clanA.name} />
          <span className="text-sm text-txt-hi truncate">{match.clanA.name}</span>
        </div>
        <div className="font-mono text-sm text-txt-mid px-2">
          {match.clanA.stars}-{match.clanB.stars}
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="text-sm text-txt-hi truncate text-right">{match.clanB.name}</span>
          <ClanBadge badge={match.clanB.badge} name={match.clanB.name} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-[10px] text-txt-dim font-mono flex-1">
          {match.clanA.attacksLeft} atk left
        </span>
        <span className="text-[10px] text-txt-dim font-mono flex-1 text-right">
          {match.clanB.attacksLeft} atk left
        </span>
      </div>
      <div className="text-center text-[10px] text-txt-dim uppercase tracking-wider mt-2">
        {match.state === "warEnded" ? "Ended" : match.state === "inWar" ? "Battle day" : "Preparation"}
      </div>
    </div>
  );
};

/**
 * Clasificacion en vivo del grupo de CWL (los 8 clanes) y el emparejamiento
 * de cada ronda, como se ve en el propio juego. Vive dentro de la vista de
 * guerra actual de CWL (CurrentWarView).
 */
const CwlGroupPanel = ({ clanTag }) => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("rounds");

  useEffect(() => {
    if (!clanTag) return;
    let cancelled = false;
    setLoading(true);
    getCwlGroupOverview(clanTag)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clanTag]);

  if (loading) {
    return <div className="text-center text-txt-low text-sm py-6">Loading group standings…</div>;
  }
  if (!overview) return null;

  return (
    <div className="mt-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("standings")}
          className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === "standings"
              ? "bg-accent-900 border border-accent-400 text-txt-hi"
              : "border border-line text-txt-low hover:border-line-strong"
          }`}
        >
          <Trophy className="w-4 h-4" />
          Standings
        </button>
        <button
          onClick={() => setTab("rounds")}
          className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === "rounds"
              ? "bg-accent-900 border border-accent-400 text-txt-hi"
              : "border border-line text-txt-low hover:border-line-strong"
          }`}
        >
          <Swords className="w-4 h-4" />
          Rounds
        </button>
      </div>

      {tab === "standings" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {overview.standings.map((clan) => (
            <StandingCard key={clan.tag} clan={clan} isUs={clan.tag === overview.ourTag} />
          ))}
        </div>
      )}

      {tab === "rounds" && (
        <div className="space-y-4">
          {overview.rounds.map((round) => (
            <div key={round.round}>
              <div className="font-mono text-xs tracking-wider text-txt-dim uppercase mb-2">
                Round {round.round}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {round.matches.length === 0 ? (
                  <p className="text-sm text-txt-dim">Not paired yet.</p>
                ) : (
                  round.matches.map((match) => (
                    <MatchCard key={match.warTag} match={match} ourTag={overview.ourTag} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CwlGroupPanel;
